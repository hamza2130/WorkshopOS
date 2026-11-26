-- Phase 6: invoices, payments, refunds and void.
--
-- An invoice starts as a draft built from the work the customer approved. Issuing it
-- gives it the next invoice number and freezes it. Money is an append-only ledger:
-- payments and refunds are rows that are never edited or deleted, and the invoice's
-- amount_paid is kept in step by the functions below. A void keeps the invoice, its
-- number, who voided it and why. Nothing here is ever hard-deleted.
--
-- Void and refund are different events (build plan): void = "this should never have
-- been billed" and needs every payment refunded first; refund = "it was billed
-- correctly, money is going back" and leaves the invoice issued with a balance.

create type public.invoice_status as enum ('draft', 'issued', 'void');
create type public.payment_method as enum ('cash', 'bank_transfer', 'card', 'jazzcash', 'easypaisa', 'cheque', 'other');
create type public.payment_kind as enum ('payment', 'refund');
create type public.invoice_line_source as enum ('approved_estimate', 'parts_used', 'added');

-- Lets invoice lines point back at the estimate line they were billed from,
-- with the same cross-workshop protection as every other reference.
alter table public.estimate_items add constraint estimate_items_workshop_id_id_key unique (workshop_id, id);

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops (id) on delete restrict,
  job_card_id uuid not null,
  customer_id uuid not null,
  vehicle_id uuid not null,
  estimate_id uuid, -- the approved estimate version it was built from
  invoice_number text, -- given when issued; drafts have none
  status public.invoice_status not null default 'draft',
  tax_label text not null,
  tax_rate numeric(5, 2) not null check (tax_rate between 0 and 100),
  subtotal numeric(12, 2) not null default 0,
  discount_total numeric(12, 2) not null default 0,
  tax_total numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  amount_paid numeric(12, 2) not null default 0,
  balance_due numeric(12, 2) generated always as (total - amount_paid) stored,
  notes text check (char_length(notes) <= 1000), -- printed on the invoice
  -- Frozen when issued, so a reprint shows what the customer was given.
  customer_name text,
  customer_phone text,
  vehicle_registration text,
  vehicle_description text,
  odometer integer,
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  issued_at timestamptz,
  issued_by uuid references public.profiles (id),
  voided_at timestamptz,
  voided_by uuid references public.profiles (id),
  void_reason text check (char_length(void_reason) <= 500),
  unique (workshop_id, invoice_number),
  unique (workshop_id, id),
  check (amount_paid >= 0 and amount_paid <= total),
  check (status <> 'issued' or (invoice_number is not null and issued_at is not null)),
  check (status <> 'void' or (voided_at is not null and nullif(btrim(void_reason), '') is not null)),
  foreign key (workshop_id, job_card_id) references public.job_cards (workshop_id, id) on delete restrict,
  foreign key (workshop_id, customer_id) references public.customers (workshop_id, id) on delete restrict,
  foreign key (workshop_id, vehicle_id) references public.vehicles (workshop_id, id) on delete restrict,
  foreign key (workshop_id, estimate_id) references public.estimates (workshop_id, id) on delete restrict
);

-- One live invoice per job. After a void, a corrected one can be made.
create unique index invoices_one_live_per_job on public.invoices (job_card_id) where status <> 'void';
create index invoices_workshop_status_idx on public.invoices (workshop_id, status, issued_at desc);
create index invoices_customer_idx on public.invoices (customer_id, created_at desc);

create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null,
  invoice_id uuid not null,
  position integer not null default 0,
  kind public.estimate_item_kind not null,
  source public.invoice_line_source not null default 'added',
  description text not null check (char_length(btrim(description)) between 1 and 300),
  estimate_item_id uuid,
  part_id uuid,
  part_number text check (char_length(part_number) <= 60),
  quantity numeric(10, 2) not null default 1 check (quantity > 0 and quantity <= 100000),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  discount numeric(12, 2) not null default 0 check (discount >= 0),
  taxable boolean not null default true,
  line_subtotal numeric(12, 2) generated always as (round(quantity * unit_price, 2)) stored,
  line_total numeric(12, 2) generated always as (round(quantity * unit_price, 2) - discount) stored,
  created_at timestamptz not null default clock_timestamp(),
  check (discount <= round(quantity * unit_price, 2)),
  foreign key (workshop_id, invoice_id) references public.invoices (workshop_id, id) on delete restrict,
  foreign key (workshop_id, estimate_item_id) references public.estimate_items (workshop_id, id) on delete restrict,
  foreign key (workshop_id, part_id) references public.parts (workshop_id, id) on delete restrict
);
create index invoice_items_invoice_idx on public.invoice_items (invoice_id, position);

-- Append-only money ledger. A refund points at the payment it gives back.
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null,
  invoice_id uuid not null,
  kind public.payment_kind not null default 'payment',
  amount numeric(12, 2) not null check (amount > 0),
  method public.payment_method not null,
  reference text check (char_length(reference) <= 120),
  note text check (char_length(note) <= 500),
  refund_of uuid,
  received_at timestamptz not null default clock_timestamp(),
  recorded_by uuid references public.profiles (id) default auth.uid(),
  unique (workshop_id, id),
  check ((kind = 'refund') = (refund_of is not null)),
  check (kind = 'payment' or nullif(btrim(note), '') is not null),
  foreign key (workshop_id, invoice_id) references public.invoices (workshop_id, id) on delete restrict,
  foreign key (workshop_id, refund_of) references public.payments (workshop_id, id) on delete restrict
);
create index payments_invoice_idx on public.payments (invoice_id, received_at);
create index payments_workshop_time_idx on public.payments (workshop_id, received_at desc);

create trigger invoices_updated_at before update on public.invoices
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Guards
-- ---------------------------------------------------------------------------

-- Status, number, totals and money only change inside the functions below
-- (flag workshopos.invoice_system). Staff may edit a draft's printed notes.
create or replace function public.guard_invoice()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'invoice_permanent' using errcode = '55000',
      detail = 'Invoices are never deleted. Void it instead — the record and its reason are kept.';
  end if;
  if current_setting('workshopos.invoice_system', true) is distinct from 'on' then
    if old.status <> 'draft' then
      raise exception 'invoice_locked' using errcode = '55000',
        detail = 'Issued and void invoices are frozen.';
    end if;
    if row(new.status, new.invoice_number, new.total, new.subtotal, new.discount_total, new.tax_total, new.tax_rate,
           new.amount_paid, new.issued_at, new.voided_at, new.void_reason, new.job_card_id, new.customer_id, new.vehicle_id)
       is distinct from
       row(old.status, old.invoice_number, old.total, old.subtotal, old.discount_total, old.tax_total, old.tax_rate,
           old.amount_paid, old.issued_at, old.voided_at, old.void_reason, old.job_card_id, old.customer_id, old.vehicle_id) then
      raise exception 'invoice_locked' using errcode = '55000';
    end if;
  end if;
  return new;
end;
$$;

create trigger invoices_guard before update or delete on public.invoices
  for each row execute function public.guard_invoice();

create or replace function public.guard_invoice_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  st public.invoice_status;
begin
  select i.status into st from public.invoices i
  where i.id = case when tg_op = 'DELETE' then old.invoice_id else new.invoice_id end;
  if st is distinct from 'draft' and current_setting('workshopos.invoice_system', true) is distinct from 'on' then
    raise exception 'invoice_locked' using errcode = '55000',
      detail = 'Issued invoices are frozen. Void it and make a new one to change the lines.';
  end if;
  if tg_op = 'UPDATE' and new.invoice_id is distinct from old.invoice_id then
    raise exception 'invoice_locked' using errcode = '55000';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger invoice_items_guard before insert or update or delete on public.invoice_items
  for each row execute function public.guard_invoice_item();

create or replace function public.recalculate_invoice(p_invoice uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.invoices v set
    subtotal = s.sub,
    discount_total = s.disc,
    tax_total = round(s.taxable * v.tax_rate / 100, 2),
    total = s.sub - s.disc + round(s.taxable * v.tax_rate / 100, 2)
  from (
    select
      coalesce(sum(i.line_subtotal), 0) as sub,
      coalesce(sum(i.discount), 0) as disc,
      coalesce(sum(i.line_total) filter (where i.taxable), 0) as taxable
    from public.invoice_items i where i.invoice_id = p_invoice
  ) s
  where v.id = p_invoice;
$$;

create or replace function public.invoice_items_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous text := coalesce(current_setting('workshopos.invoice_system', true), '');
begin
  perform set_config('workshopos.invoice_system', 'on', true);
  perform public.recalculate_invoice(case when tg_op = 'DELETE' then old.invoice_id else new.invoice_id end);
  perform set_config('workshopos.invoice_system', previous, true);
  return null;
end;
$$;

create trigger invoice_items_totals after insert or update or delete on public.invoice_items
  for each row execute function public.invoice_items_changed();

-- The ledger is append-only for everyone, including the owner.
create or replace function public.guard_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'payment_permanent' using errcode = '55000',
    detail = 'Payments are never edited or deleted. Record a refund to give money back.';
end;
$$;

create trigger payments_guard before update or delete on public.payments
  for each row execute function public.guard_payment();

-- A vehicle can't leave without an issued invoice, and a job with a live
-- invoice can't be cancelled (void the invoice first, with its reason).
create or replace function public.guard_job_billing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'delivered' and old.status is distinct from 'delivered'
     and not exists (select 1 from public.invoices i where i.job_card_id = new.id and i.status = 'issued') then
    raise exception 'invoice_required' using errcode = '55000',
      detail = 'Issue the invoice before the vehicle is delivered.';
  end if;
  if new.status = 'cancelled' and old.status is distinct from 'cancelled'
     and exists (select 1 from public.invoices i where i.job_card_id = new.id and i.status <> 'void') then
    raise exception 'invoice_open' using errcode = '55000',
      detail = 'This job has an invoice. Void it before cancelling the job.';
  end if;
  return new;
end;
$$;

create trigger job_cards_billing_guard before update of status on public.job_cards
  for each row execute function public.guard_job_billing();

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- A draft from the approved lines of the latest approved estimate version.
create or replace function public.create_invoice(p_job uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  j public.job_cards;
  e public.estimates;
  w public.workshops;
  new_id uuid;
begin
  select * into j from public.job_cards where id = p_job for update;
  if j.id is null or not public.has_workshop_permission(j.workshop_id, 'invoices.manage') then
    raise exception 'Job card not found' using errcode = 'P0002';
  end if;
  if j.status not in ('quality_check', 'ready_for_delivery', 'delivered') then
    raise exception 'invoice_not_allowed' using errcode = '55000',
      detail = format('Invoices are made once the work is done (this job is %s).', j.status);
  end if;
  if exists (select 1 from public.invoices where job_card_id = p_job and status <> 'void') then
    raise exception 'invoice_exists' using errcode = '23505', detail = 'This job already has an invoice.';
  end if;

  select * into e from public.estimates
  where job_card_id = p_job and status in ('approved', 'partially_approved')
  order by version desc limit 1;
  select * into w from public.workshops where id = j.workshop_id;

  insert into public.invoices (workshop_id, job_card_id, customer_id, vehicle_id, estimate_id, tax_label, tax_rate)
  values (j.workshop_id, p_job, j.customer_id, j.vehicle_id, e.id,
    coalesce(e.tax_label, w.tax_label), coalesce(e.tax_rate, w.tax_rate))
  returning id into new_id;

  if e.id is not null then
    insert into public.invoice_items (
      workshop_id, invoice_id, position, kind, source, description, estimate_item_id, part_id, part_number,
      quantity, unit_price, discount, taxable
    )
    select i.workshop_id, new_id, row_number() over (order by i.position, i.created_at) - 1, i.kind, 'approved_estimate',
      i.description, i.id, i.part_id, i.part_number, i.quantity, i.unit_price, i.discount, i.taxable
    from public.estimate_items i
    where i.estimate_id = e.id and i.approval_status = 'approved';
  end if;

  perform public.log_activity(j.workshop_id, 'invoice', new_id, 'invoice.created',
    jsonb_build_object('job_card_id', p_job, 'job_number', j.job_number, 'estimate_version', e.version));
  return new_id;
end;
$$;

-- Numbers the draft, freezes it and keeps a copy of who and what it was for.
create or replace function public.issue_invoice(p_invoice uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.invoices;
  j public.job_cards;
  c public.customers;
  vh public.vehicles;
  prefix text;
  number text;
begin
  select * into v from public.invoices where id = p_invoice for update;
  if v.id is null or not public.has_workshop_permission(v.workshop_id, 'invoices.manage') then
    raise exception 'Invoice not found' using errcode = 'P0002';
  end if;
  if v.status <> 'draft' then
    raise exception 'invoice_not_draft' using errcode = '55000', detail = 'Only drafts can be issued.';
  end if;
  if not exists (select 1 from public.invoice_items where invoice_id = v.id) then
    raise exception 'invoice_empty' using errcode = '22023', detail = 'Add at least one line before issuing.';
  end if;
  select * into j from public.job_cards where id = v.job_card_id;
  if j.status not in ('quality_check', 'ready_for_delivery', 'delivered') then
    raise exception 'invoice_not_allowed' using errcode = '55000',
      detail = format('Invoices are issued once the work is done (this job is %s).', j.status);
  end if;
  select * into c from public.customers where id = v.customer_id;
  select * into vh from public.vehicles where id = v.vehicle_id;
  select w.invoice_prefix into prefix from public.workshops w where w.id = v.workshop_id;
  number := prefix || '-' || lpad(public.next_workshop_number(v.workshop_id, 'invoice')::text, 4, '0');

  perform set_config('workshopos.invoice_system', 'on', true);
  update public.invoices set
    status = 'issued',
    invoice_number = number,
    issued_at = clock_timestamp(),
    issued_by = (select auth.uid()),
    customer_name = c.name,
    customer_phone = c.phone,
    vehicle_registration = vh.registration_number,
    vehicle_description = nullif(concat_ws(' ', vh.make, vh.model, vh.variant, vh.year::text), ''),
    odometer = j.check_in_mileage
  where id = v.id;
  perform set_config('workshopos.invoice_system', '', true);

  perform public.log_activity(v.workshop_id, 'invoice', v.id, 'invoice.issued',
    jsonb_build_object('invoice_number', number, 'job_number', j.job_number, 'total', v.total));
  return number;
end;
$$;

-- Only when no money is held against it: refund every payment first.
create or replace function public.void_invoice(p_invoice uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.invoices;
  why text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  select * into v from public.invoices where id = p_invoice for update;
  if v.id is null or not public.has_workshop_permission(v.workshop_id, 'invoices.manage') then
    raise exception 'Invoice not found' using errcode = 'P0002';
  end if;
  if v.status = 'void' then
    raise exception 'invoice_void' using errcode = '55000', detail = 'This invoice is already void.';
  end if;
  if why is null then
    raise exception 'reason_required' using errcode = '22023', detail = 'Say why the invoice is being voided.';
  end if;
  if v.amount_paid > 0 then
    raise exception 'invoice_has_payments' using errcode = '55000',
      detail = 'Money has been received on this invoice. Refund the payments before voiding it.';
  end if;

  perform set_config('workshopos.invoice_system', 'on', true);
  update public.invoices set
    status = 'void',
    voided_at = clock_timestamp(),
    voided_by = (select auth.uid()),
    void_reason = left(why, 500)
  where id = v.id;
  perform set_config('workshopos.invoice_system', '', true);

  perform public.log_activity(v.workshop_id, 'invoice', v.id, 'invoice.voided',
    jsonb_build_object('invoice_number', v.invoice_number, 'was', v.status, 'total', v.total, 'reason', why));
end;
$$;

create or replace function public.record_payment(
  p_invoice uuid,
  p_amount numeric,
  p_method public.payment_method,
  p_reference text default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.invoices;
  j public.job_cards;
  new_id uuid;
begin
  select * into v from public.invoices where id = p_invoice for update;
  if v.id is null or not public.has_workshop_permission(v.workshop_id, 'payments.record') then
    raise exception 'Invoice not found' using errcode = 'P0002';
  end if;
  if v.status <> 'issued' then
    raise exception 'invoice_not_issued' using errcode = '55000', detail = 'Payments are taken against issued invoices.';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount <> round(p_amount, 2) then
    raise exception 'amount_invalid' using errcode = '22023';
  end if;
  if p_amount > v.balance_due then
    raise exception 'overpayment' using errcode = '22023',
      detail = format('Only %s is still due on this invoice.', v.balance_due);
  end if;

  insert into public.payments (workshop_id, invoice_id, kind, amount, method, reference, note)
  values (v.workshop_id, v.id, 'payment', p_amount, p_method,
    nullif(btrim(coalesce(p_reference, '')), ''), nullif(btrim(coalesce(p_note, '')), ''))
  returning id into new_id;

  perform set_config('workshopos.invoice_system', 'on', true);
  update public.invoices set amount_paid = amount_paid + p_amount where id = v.id;
  perform set_config('workshopos.invoice_system', '', true);

  perform public.log_activity(v.workshop_id, 'invoice', v.id, 'payment.recorded',
    jsonb_build_object('invoice_number', v.invoice_number, 'amount', p_amount, 'method', p_method));

  if p_amount = v.balance_due then
    select * into j from public.job_cards where id = v.job_card_id;
    perform public.notify_job_staff(j.id, 'invoice_paid',
      format('%s: paid in full', j.job_number),
      format('%s · %s received', v.invoice_number, v.total));
  end if;
  return new_id;
end;
$$;

-- Gives back some or all of one payment. The invoice stays issued and owes again.
create or replace function public.refund_payment(
  p_payment uuid,
  p_amount numeric,
  p_method public.payment_method,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.payments;
  v public.invoices;
  already numeric(12, 2);
  why text := nullif(btrim(coalesce(p_reason, '')), '');
  new_id uuid;
begin
  select * into p from public.payments where id = p_payment;
  if p.id is null or not public.has_workshop_permission(p.workshop_id, 'invoices.manage') then
    raise exception 'Payment not found' using errcode = 'P0002';
  end if;
  if p.kind <> 'payment' then
    raise exception 'refund_of_refund' using errcode = '22023', detail = 'Only payments can be refunded.';
  end if;
  select * into v from public.invoices where id = p.invoice_id for update;
  if why is null then
    raise exception 'reason_required' using errcode = '22023', detail = 'Say why the money is going back.';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount <> round(p_amount, 2) then
    raise exception 'amount_invalid' using errcode = '22023';
  end if;
  select coalesce(sum(amount), 0) into already from public.payments where refund_of = p.id;
  if p_amount > p.amount - already then
    raise exception 'refund_too_large' using errcode = '22023',
      detail = format('At most %s of this payment can still be refunded.', p.amount - already);
  end if;

  insert into public.payments (workshop_id, invoice_id, kind, amount, method, note, refund_of)
  values (p.workshop_id, p.invoice_id, 'refund', p_amount, p_method, left(why, 500), p.id)
  returning id into new_id;

  perform set_config('workshopos.invoice_system', 'on', true);
  update public.invoices set amount_paid = amount_paid - p_amount where id = v.id;
  perform set_config('workshopos.invoice_system', '', true);

  perform public.log_activity(v.workshop_id, 'invoice', v.id, 'payment.refunded',
    jsonb_build_object('invoice_number', v.invoice_number, 'amount', p_amount, 'method', p_method, 'reason', why));
  return new_id;
end;
$$;

-- Today's numbers for the dashboard. Invoiced and collected are kept apart (PRD).
create or replace function public.billing_summary(ws uuid, p_from timestamptz, p_to timestamptz)
returns table (invoiced numeric, invoice_count bigint, collected numeric, outstanding numeric, unpaid_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    coalesce((select sum(total) from public.invoices
      where workshop_id = ws and status = 'issued' and issued_at >= p_from and issued_at < p_to), 0),
    (select count(*) from public.invoices
      where workshop_id = ws and status = 'issued' and issued_at >= p_from and issued_at < p_to),
    coalesce((select sum(case when kind = 'payment' then amount else -amount end) from public.payments
      where workshop_id = ws and received_at >= p_from and received_at < p_to), 0),
    coalesce((select sum(balance_due) from public.invoices where workshop_id = ws and status = 'issued'), 0),
    (select count(*) from public.invoices where workshop_id = ws and status = 'issued' and balance_due > 0);
$$;

-- ---------------------------------------------------------------------------
-- Row-level security and grants
-- ---------------------------------------------------------------------------

alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payments enable row level security;

-- Advisors see billing too: they hand the car back and need to know what's owed.
create policy "staff read invoices" on public.invoices for select to authenticated
  using (public.has_any_workshop_permission(workshop_id, array['invoices.manage', 'payments.record', 'jobs.manage']));
create policy "billing staff edit draft notes" on public.invoices for update to authenticated
  using (public.has_workshop_permission(workshop_id, 'invoices.manage'))
  with check (public.has_workshop_permission(workshop_id, 'invoices.manage'));

create policy "staff read invoice lines" on public.invoice_items for select to authenticated
  using (public.has_any_workshop_permission(workshop_id, array['invoices.manage', 'payments.record', 'jobs.manage']));
create policy "billing staff add invoice lines" on public.invoice_items for insert to authenticated
  with check (public.has_workshop_permission(workshop_id, 'invoices.manage'));
create policy "billing staff edit invoice lines" on public.invoice_items for update to authenticated
  using (public.has_workshop_permission(workshop_id, 'invoices.manage'))
  with check (public.has_workshop_permission(workshop_id, 'invoices.manage'));
create policy "billing staff remove invoice lines" on public.invoice_items for delete to authenticated
  using (public.has_workshop_permission(workshop_id, 'invoices.manage'));

create policy "staff read payments" on public.payments for select to authenticated
  using (public.has_any_workshop_permission(workshop_id, array['invoices.manage', 'payments.record', 'jobs.manage']));

revoke all on public.invoices, public.invoice_items, public.payments from anon, authenticated;
grant select on public.invoices, public.invoice_items, public.payments to authenticated;
grant update (notes) on public.invoices to authenticated;
grant insert (workshop_id, invoice_id, position, kind, source, description, estimate_item_id, part_id, part_number,
  quantity, unit_price, discount, taxable) on public.invoice_items to authenticated;
grant update (position, description, quantity, unit_price, discount, taxable) on public.invoice_items to authenticated;
grant delete on public.invoice_items to authenticated;

revoke execute on function public.recalculate_invoice(uuid) from public, anon, authenticated;
grant execute on function public.create_invoice(uuid) to authenticated;
grant execute on function public.issue_invoice(uuid) to authenticated;
grant execute on function public.void_invoice(uuid, text) to authenticated;
grant execute on function public.record_payment(uuid, numeric, public.payment_method, text, text) to authenticated;
grant execute on function public.refund_payment(uuid, numeric, public.payment_method, text) to authenticated;
grant execute on function public.billing_summary(uuid, timestamptz, timestamptz) to authenticated;
