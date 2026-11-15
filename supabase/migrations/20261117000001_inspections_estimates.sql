-- Phase 4: vehicle inspections, labour and parts catalogues, versioned estimates,
-- customer approval by secure link (or recorded by staff), and in-app notifications.
--
-- Gate: a revised estimate needs fresh approval. Every revision is a new estimate
-- version whose lines start as 'pending'; sent versions are frozen; sending a new
-- version supersedes the old one and kills its link. Approvals never carry over.

create type public.inspection_category as enum (
  'engine', 'transmission', 'brakes', 'suspension', 'steering', 'electrical', 'battery',
  'tyres', 'cooling', 'air_conditioning', 'fluids', 'exterior', 'interior'
);
create type public.inspection_outcome as enum ('normal', 'needs_attention', 'requires_repair', 'not_inspected');
create type public.estimate_status as enum (
  'draft', 'sent', 'approved', 'partially_approved', 'rejected', 'withdrawn', 'superseded'
);
create type public.estimate_item_kind as enum ('labour', 'part', 'other');
create type public.estimate_item_source as enum ('customer_request', 'recommendation');
create type public.approval_status as enum ('pending', 'approved', 'declined');
create type public.decision_method as enum ('link', 'in_person', 'phone', 'whatsapp');

alter table public.job_attachments drop constraint job_attachments_category_check;
alter table public.job_attachments add constraint job_attachments_category_check
  check (category in ('vehicle_photo', 'damage_photo', 'inspection_photo', 'document'));

-- Inspection, estimate sending and customer decisions now drive these moves;
-- 'system' is a permission nobody holds, so they can't be pressed by hand.
update public.job_status_actions set permission = 'system'
where code in ('complete_inspection', 'send_estimate', 'record_approval', 'revise_estimate');

insert into public.job_status_actions (code, label, from_status, to_status, requires_reason, permission, tone, sort_order) values
  ('customer_declined', 'Customer declined the estimate', 'awaiting_approval', 'awaiting_estimate', false, 'system', 'secondary', 90),
  ('revise_estimate', 'Revise estimate', 'approved', 'awaiting_estimate', true, 'system', 'secondary', 90),
  ('revise_estimate', 'Revise estimate', 'awaiting_assignment', 'awaiting_estimate', true, 'system', 'secondary', 90);

-- ---------------------------------------------------------------------------
-- Catalogues
-- ---------------------------------------------------------------------------

create table public.labour_items (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops (id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 2 and 120),
  description text check (char_length(description) <= 500),
  default_price numeric(12, 2) not null default 0 check (default_price >= 0),
  estimated_minutes integer check (estimated_minutes between 1 and 10000),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workshop_id, id)
);
create unique index labour_items_name_idx on public.labour_items (workshop_id, lower(btrim(name)));

-- Phase 7 adds stock levels and movements to this table.
create table public.parts (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops (id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 2 and 120),
  part_number text check (char_length(part_number) <= 60),
  brand text check (char_length(brand) <= 60),
  category text check (char_length(category) <= 60),
  supplier text check (char_length(supplier) <= 120),
  cost_price numeric(12, 2) check (cost_price >= 0),
  selling_price numeric(12, 2) not null default 0 check (selling_price >= 0),
  unit text not null default 'piece' check (char_length(btrim(unit)) between 1 and 20),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workshop_id, id)
);
create index parts_workshop_name_idx on public.parts (workshop_id, lower(name));

-- ---------------------------------------------------------------------------
-- Inspections: one per job card, one row per category.
-- ---------------------------------------------------------------------------

create table public.job_inspections (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null,
  job_card_id uuid not null unique,
  started_by uuid references public.profiles (id) default auth.uid(),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  completed_by uuid references public.profiles (id),
  summary text check (char_length(summary) <= 2000),
  unique (workshop_id, id),
  foreign key (workshop_id, job_card_id) references public.job_cards (workshop_id, id) on delete restrict
);

create table public.job_inspection_items (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null,
  inspection_id uuid not null,
  category public.inspection_category not null,
  outcome public.inspection_outcome not null default 'not_inspected',
  notes text check (char_length(notes) <= 1000),
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  unique (inspection_id, category),
  foreign key (workshop_id, inspection_id) references public.job_inspections (workshop_id, id) on delete restrict
);

-- ---------------------------------------------------------------------------
-- Estimates: one row per version; lines per version.
-- ---------------------------------------------------------------------------

create table public.estimates (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null,
  job_card_id uuid not null,
  version integer not null check (version >= 1),
  status public.estimate_status not null default 'draft',
  tax_label text not null,
  tax_rate numeric(5, 2) not null check (tax_rate between 0 and 100),
  subtotal numeric(12, 2) not null default 0,
  discount_total numeric(12, 2) not null default 0,
  tax_total numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  estimated_completion text check (char_length(estimated_completion) <= 120),
  terms text check (char_length(terms) <= 2000),
  customer_note text check (char_length(customer_note) <= 2000),
  approval_token_hash text unique,
  approval_expires_at timestamptz,
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  sent_by uuid references public.profiles (id),
  decided_at timestamptz,
  closed_at timestamptz,
  unique (job_card_id, version),
  unique (workshop_id, id),
  foreign key (workshop_id, job_card_id) references public.job_cards (workshop_id, id) on delete restrict
);
create unique index estimates_one_draft_per_job on public.estimates (job_card_id) where status = 'draft';
create unique index estimates_one_open_per_job on public.estimates (job_card_id) where status = 'sent';

create table public.estimate_items (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null,
  estimate_id uuid not null,
  position integer not null default 0,
  kind public.estimate_item_kind not null,
  source public.estimate_item_source not null default 'customer_request',
  inspection_category public.inspection_category,
  description text not null check (char_length(btrim(description)) between 1 and 300),
  labour_item_id uuid,
  part_id uuid,
  part_number text check (char_length(part_number) <= 60),
  quantity numeric(10, 2) not null default 1 check (quantity > 0 and quantity <= 100000),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  discount numeric(12, 2) not null default 0 check (discount >= 0),
  taxable boolean not null default true,
  line_subtotal numeric(12, 2) generated always as (round(quantity * unit_price, 2)) stored,
  line_total numeric(12, 2) generated always as (round(quantity * unit_price, 2) - discount) stored,
  approval_status public.approval_status not null default 'pending',
  created_at timestamptz not null default clock_timestamp(),
  check (discount <= round(quantity * unit_price, 2)),
  foreign key (workshop_id, estimate_id) references public.estimates (workshop_id, id) on delete restrict,
  foreign key (workshop_id, labour_item_id) references public.labour_items (workshop_id, id) on delete restrict,
  foreign key (workshop_id, part_id) references public.parts (workshop_id, id) on delete restrict
);

-- Append-only record of every customer decision (PRD: estimate_approvals).
create table public.estimate_decisions (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null,
  estimate_id uuid not null,
  version integer not null,
  decision public.estimate_status not null check (decision in ('approved', 'partially_approved', 'rejected')),
  approved_item_ids uuid[] not null default '{}',
  declined_item_ids uuid[] not null default '{}',
  approved_total numeric(12, 2) not null,
  method public.decision_method not null,
  customer_name text check (char_length(customer_name) <= 120),
  note text check (char_length(note) <= 500),
  recorded_by uuid references public.profiles (id),
  decided_at timestamptz not null default clock_timestamp(),
  foreign key (workshop_id, estimate_id) references public.estimates (workshop_id, id) on delete restrict
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops (id) on delete restrict,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  link text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index estimates_job_idx on public.estimates (job_card_id, version desc);
create index estimates_workshop_status_idx on public.estimates (workshop_id, status);
create index estimate_items_estimate_idx on public.estimate_items (estimate_id, position);
create index estimate_decisions_estimate_idx on public.estimate_decisions (estimate_id);
create index notifications_recipient_idx on public.notifications (recipient_id, read_at, created_at desc);
create index job_inspection_items_inspection_idx on public.job_inspection_items (inspection_id);

create trigger labour_items_updated_at before update on public.labour_items
  for each row execute function public.set_updated_at();
create trigger parts_updated_at before update on public.parts
  for each row execute function public.set_updated_at();
create trigger estimates_updated_at before update on public.estimates
  for each row execute function public.set_updated_at();
create trigger labour_items_audit after insert or update on public.labour_items
  for each row execute function public.audit_record_change('labour_item');
create trigger parts_audit after insert or update on public.parts
  for each row execute function public.audit_record_change('part');

-- ---------------------------------------------------------------------------
-- Guards and totals
-- ---------------------------------------------------------------------------

create or replace function public.guard_inspection_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.job_inspections i where i.id = new.inspection_id and i.completed_at is not null) then
    raise exception 'inspection_completed' using errcode = '55000',
      detail = 'This inspection has been completed and can no longer be changed.';
  end if;
  new.updated_by := (select auth.uid());
  new.updated_at := now();
  return new;
end;
$$;

create trigger job_inspection_items_guard before update on public.job_inspection_items
  for each row execute function public.guard_inspection_item();

-- Lines can only change while their estimate is a draft. Decisions are the one
-- exception, and they go through apply_estimate_decision().
create or replace function public.guard_estimate_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  st public.estimate_status;
begin
  select e.status into st from public.estimates e
  where e.id = case when tg_op = 'DELETE' then old.estimate_id else new.estimate_id end;
  if st is distinct from 'draft' and current_setting('workshopos.estimate_system', true) is distinct from 'on' then
    raise exception 'estimate_locked' using errcode = '55000',
      detail = 'Sent estimates are frozen. Revise the estimate to change it — the customer will approve the new version.';
  end if;
  if tg_op = 'UPDATE' and new.estimate_id is distinct from old.estimate_id then
    raise exception 'estimate_locked' using errcode = '55000';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger estimate_items_guard before insert or update or delete on public.estimate_items
  for each row execute function public.guard_estimate_item();

create or replace function public.recalculate_estimate(p_estimate uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.estimates e set
    subtotal = s.sub,
    discount_total = s.disc,
    tax_total = round(s.taxable * e.tax_rate / 100, 2),
    total = s.sub - s.disc + round(s.taxable * e.tax_rate / 100, 2)
  from (
    select
      coalesce(sum(i.line_subtotal), 0) as sub,
      coalesce(sum(i.discount), 0) as disc,
      coalesce(sum(i.line_total) filter (where i.taxable), 0) as taxable
    from public.estimate_items i where i.estimate_id = p_estimate
  ) s
  where e.id = p_estimate;
$$;

create or replace function public.estimate_items_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Restore whatever the caller had set, so a decision in progress keeps its flag.
  previous text := coalesce(current_setting('workshopos.estimate_system', true), '');
begin
  perform set_config('workshopos.estimate_system', 'on', true);
  perform public.recalculate_estimate(case when tg_op = 'DELETE' then old.estimate_id else new.estimate_id end);
  perform set_config('workshopos.estimate_system', previous, true);
  return null;
end;
$$;

create trigger estimate_items_totals after insert or update or delete on public.estimate_items
  for each row execute function public.estimate_items_changed();

create or replace function public.guard_estimate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_setting('workshopos.estimate_system', true) is distinct from 'on' then
    if old.status <> 'draft' then
      raise exception 'estimate_locked' using errcode = '55000',
        detail = 'Sent estimates are frozen. Revise the estimate to change it.';
    end if;
    if new.status is distinct from old.status or new.total is distinct from old.total
       or new.tax_rate is distinct from old.tax_rate or new.approval_token_hash is distinct from old.approval_token_hash then
      raise exception 'estimate_locked' using errcode = '55000';
    end if;
  end if;
  return new;
end;
$$;

create trigger estimates_guard before update on public.estimates
  for each row execute function public.guard_estimate();

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------

-- Tells the job's service advisor and every active owner (once each), except
-- whoever made the change — nobody needs a notification about their own action.
create or replace function public.notify_job_staff(p_job uuid, p_kind text, p_title text, p_body text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (workshop_id, recipient_id, kind, title, body, link)
  select distinct j.workshop_id, r.user_id, p_kind, p_title, p_body, '/jobs/' || j.id
  from public.job_cards j
  join lateral (
    select j.service_advisor_id as user_id
    union
    select m.user_id from public.workshop_members m
    where m.workshop_id = j.workshop_id and m.role = 'owner' and m.is_active
  ) r on r.user_id is not null and r.user_id is distinct from (select auth.uid())
  where j.id = p_job;
$$;

-- ---------------------------------------------------------------------------
-- Inspection RPCs
-- ---------------------------------------------------------------------------

create or replace function public.start_inspection(p_job uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  j public.job_cards;
  insp uuid;
begin
  select * into j from public.job_cards where id = p_job;
  if j.id is null or not public.has_workshop_permission(j.workshop_id, 'jobs.manage') then
    raise exception 'Job card not found' using errcode = 'P0002';
  end if;
  if j.status in ('draft', 'delivered', 'cancelled') then
    raise exception 'inspection_not_allowed' using errcode = '55000',
      detail = 'Check the vehicle in before inspecting it.';
  end if;

  select id into insp from public.job_inspections where job_card_id = p_job;
  if insp is not null then
    return insp;
  end if;

  insert into public.job_inspections (workshop_id, job_card_id) values (j.workshop_id, p_job) returning id into insp;
  insert into public.job_inspection_items (workshop_id, inspection_id, category)
  select j.workshop_id, insp, c from unnest(enum_range(null::public.inspection_category)) c;
  return insp;
end;
$$;

create or replace function public.complete_inspection(p_job uuid, p_summary text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  j public.job_cards;
  insp public.job_inspections;
begin
  select * into j from public.job_cards where id = p_job for update;
  if j.id is null or not public.has_workshop_permission(j.workshop_id, 'jobs.manage') then
    raise exception 'Job card not found' using errcode = 'P0002';
  end if;
  select * into insp from public.job_inspections where job_card_id = p_job for update;
  if insp.id is null then
    raise exception 'inspection_not_started' using errcode = '55000';
  end if;
  if insp.completed_at is not null then
    raise exception 'inspection_completed' using errcode = '55000';
  end if;

  update public.job_inspections
  set completed_at = clock_timestamp(), completed_by = (select auth.uid()),
      summary = nullif(btrim(coalesce(p_summary, '')), '')
  where id = insp.id;

  if j.status = 'awaiting_inspection' then
    perform set_config('workshopos.job_action', 'complete_inspection', true);
    perform set_config('workshopos.job_reason', '', true);
    update public.job_cards set status = 'awaiting_estimate' where id = p_job;
    perform set_config('workshopos.job_action', '', true);
  end if;
  perform public.log_activity(j.workshop_id, 'job_card', p_job, 'inspection.completed', '{}');
end;
$$;

-- ---------------------------------------------------------------------------
-- Estimate RPCs
-- ---------------------------------------------------------------------------

-- New draft version. A revision copies the previous version's lines, all back to
-- 'pending'; an undecided sent version is withdrawn so its link stops working.
create or replace function public.create_estimate(p_job uuid, p_reason text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  j public.job_cards;
  latest public.estimates;
  w public.workshops;
  new_id uuid;
  why text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  select * into j from public.job_cards where id = p_job for update;
  if j.id is null or not public.has_workshop_permission(j.workshop_id, 'estimates.manage') then
    raise exception 'Job card not found' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.estimates where job_card_id = p_job and status = 'draft') then
    raise exception 'draft_exists' using errcode = '23505', detail = 'This job already has a draft estimate.';
  end if;
  if j.status not in ('awaiting_estimate', 'awaiting_approval', 'approved', 'awaiting_assignment') then
    raise exception 'estimate_not_allowed' using errcode = '55000',
      detail = format('Estimates are prepared after inspection and before work starts (this job is %s).', j.status);
  end if;

  select * into latest from public.estimates where job_card_id = p_job order by version desc limit 1;

  perform set_config('workshopos.estimate_system', 'on', true);
  if j.status <> 'awaiting_estimate' then
    if why is null then
      raise exception 'reason_required' using errcode = '22023', detail = 'Say why the estimate is being revised.';
    end if;
    perform set_config('workshopos.job_action', 'revise_estimate', true);
    perform set_config('workshopos.job_reason', why, true);
    update public.job_cards set status = 'awaiting_estimate' where id = p_job;
    perform set_config('workshopos.job_action', '', true);
    perform set_config('workshopos.job_reason', '', true);
  end if;

  if latest.status = 'sent' then
    update public.estimates set status = 'withdrawn', closed_at = clock_timestamp(), approval_token_hash = null
    where id = latest.id;
  end if;

  select * into w from public.workshops where id = j.workshop_id;
  insert into public.estimates (workshop_id, job_card_id, version, tax_label, tax_rate, terms, estimated_completion)
  values (j.workshop_id, p_job, coalesce(latest.version, 0) + 1, w.tax_label, w.tax_rate, latest.terms, latest.estimated_completion)
  returning id into new_id;

  if latest.id is not null then
    insert into public.estimate_items (
      workshop_id, estimate_id, position, kind, source, inspection_category, description,
      labour_item_id, part_id, part_number, quantity, unit_price, discount, taxable
    )
    select workshop_id, new_id, position, kind, source, inspection_category, description,
      labour_item_id, part_id, part_number, quantity, unit_price, discount, taxable
    from public.estimate_items where estimate_id = latest.id
    order by position, created_at;
  end if;
  perform set_config('workshopos.estimate_system', '', true);

  perform public.log_activity(j.workshop_id, 'job_card', p_job, 'estimate.created',
    jsonb_build_object('version', coalesce(latest.version, 0) + 1, 'reason', why));
  return new_id;
end;
$$;

-- Freezes the draft, issues a fresh approval link (only its hash is stored),
-- supersedes every earlier version, and moves the job to awaiting approval.
create or replace function public.send_estimate(p_estimate uuid, p_valid_days integer default 7)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.estimates;
  j public.job_cards;
  token text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  select * into e from public.estimates where id = p_estimate for update;
  if e.id is null or not public.has_workshop_permission(e.workshop_id, 'estimates.manage') then
    raise exception 'Estimate not found' using errcode = 'P0002';
  end if;
  if e.status <> 'draft' then
    raise exception 'estimate_not_draft' using errcode = '55000';
  end if;
  if not exists (select 1 from public.estimate_items where estimate_id = e.id) then
    raise exception 'estimate_empty' using errcode = '22023', detail = 'Add at least one line before sending.';
  end if;
  if p_valid_days not between 1 and 60 then
    raise exception 'The link must be valid for 1 to 60 days' using errcode = '22023';
  end if;
  select * into j from public.job_cards where id = e.job_card_id for update;
  if j.status <> 'awaiting_estimate' then
    raise exception 'estimate_not_allowed' using errcode = '55000',
      detail = format('The job must be awaiting an estimate to send one (it is %s).', j.status);
  end if;

  perform set_config('workshopos.estimate_system', 'on', true);
  update public.estimates set status = 'superseded', closed_at = clock_timestamp(), approval_token_hash = null
  where job_card_id = e.job_card_id and id <> e.id and status in ('sent', 'approved', 'partially_approved', 'rejected');
  update public.estimates set
    status = 'sent',
    sent_at = clock_timestamp(),
    sent_by = (select auth.uid()),
    approval_token_hash = encode(extensions.digest(token, 'sha256'), 'hex'),
    approval_expires_at = now() + make_interval(days => p_valid_days)
  where id = e.id;
  perform set_config('workshopos.estimate_system', '', true);

  perform set_config('workshopos.job_action', 'send_estimate', true);
  perform set_config('workshopos.job_reason', format('Estimate version %s sent · total %s', e.version, e.total), true);
  update public.job_cards set status = 'awaiting_approval' where id = j.id;
  perform set_config('workshopos.job_action', '', true);
  perform set_config('workshopos.job_reason', '', true);

  perform public.log_activity(e.workshop_id, 'job_card', j.id, 'estimate.sent',
    jsonb_build_object('version', e.version, 'total', e.total));
  return token;
end;
$$;

-- Replaces a lost or expired link for a version that is still waiting for the customer.
create or replace function public.renew_estimate_link(p_estimate uuid, p_valid_days integer default 7)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.estimates;
  token text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  select * into e from public.estimates where id = p_estimate for update;
  if e.id is null or not public.has_workshop_permission(e.workshop_id, 'estimates.manage') then
    raise exception 'Estimate not found' using errcode = 'P0002';
  end if;
  if e.status <> 'sent' then
    raise exception 'estimate_not_open' using errcode = '55000', detail = 'Only estimates waiting for the customer have a link.';
  end if;
  if p_valid_days not between 1 and 60 then
    raise exception 'The link must be valid for 1 to 60 days' using errcode = '22023';
  end if;
  perform set_config('workshopos.estimate_system', 'on', true);
  update public.estimates set
    approval_token_hash = encode(extensions.digest(token, 'sha256'), 'hex'),
    approval_expires_at = now() + make_interval(days => p_valid_days)
  where id = e.id;
  perform set_config('workshopos.estimate_system', '', true);
  perform public.log_activity(e.workshop_id, 'job_card', e.job_card_id, 'estimate.link_renewed',
    jsonb_build_object('version', e.version));
  return token;
end;
$$;

-- Internal: records a decision on a sent estimate and moves the job.
create or replace function public.apply_estimate_decision(
  p_estimate uuid,
  p_approved uuid[],
  p_method public.decision_method,
  p_customer_name text,
  p_note text,
  p_recorded_by uuid
)
returns public.estimate_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.estimates;
  j public.job_cards;
  requested uuid[] := coalesce(p_approved, '{}');
  approved_ids uuid[];
  declined_ids uuid[];
  result public.estimate_status;
  approved_total numeric(12, 2);
  item_count integer;
begin
  select * into e from public.estimates where id = p_estimate for update;
  if e.status <> 'sent' then
    raise exception 'already_decided' using errcode = '55000', detail = 'This estimate is no longer waiting for a decision.';
  end if;

  select
    coalesce(array_agg(i.id) filter (where i.id = any (requested)), '{}'),
    coalesce(array_agg(i.id) filter (where not (i.id = any (requested))), '{}'),
    count(*)
  into approved_ids, declined_ids, item_count
  from public.estimate_items i where i.estimate_id = e.id;

  if cardinality(approved_ids) <> cardinality(array(select distinct unnest(requested))) then
    raise exception 'unknown_item' using errcode = '22023', detail = 'Some approved lines are not part of this estimate.';
  end if;

  result := case
    when cardinality(declined_ids) = 0 then 'approved'::public.estimate_status
    when cardinality(approved_ids) = 0 then 'rejected'::public.estimate_status
    else 'partially_approved'::public.estimate_status
  end;

  perform set_config('workshopos.estimate_system', 'on', true);
  update public.estimate_items
  set approval_status = case when id = any (approved_ids) then 'approved'::public.approval_status else 'declined'::public.approval_status end
  where estimate_id = e.id;

  select coalesce(sum(i.line_total), 0) + round(coalesce(sum(i.line_total) filter (where i.taxable), 0) * e.tax_rate / 100, 2)
  into approved_total
  from public.estimate_items i where i.estimate_id = e.id and i.id = any (approved_ids);

  update public.estimates set status = result, decided_at = clock_timestamp() where id = e.id;
  perform set_config('workshopos.estimate_system', '', true);

  insert into public.estimate_decisions (
    workshop_id, estimate_id, version, decision, approved_item_ids, declined_item_ids,
    approved_total, method, customer_name, note, recorded_by
  ) values (
    e.workshop_id, e.id, e.version, result, approved_ids, declined_ids,
    approved_total, p_method, p_customer_name, p_note, p_recorded_by
  );

  select * into j from public.job_cards where id = e.job_card_id for update;
  if j.status = 'awaiting_approval' then
    perform set_config('workshopos.job_action', case when result = 'rejected' then 'customer_declined' else 'record_approval' end, true);
    perform set_config('workshopos.job_reason',
      format('%s of %s lines approved (%s)', cardinality(approved_ids), item_count,
        case p_method when 'link' then 'via approval link' when 'in_person' then 'in person'
          when 'phone' then 'by phone' else 'on WhatsApp' end), true);
    update public.job_cards
    set status = case when result = 'rejected' then 'awaiting_estimate'::public.job_status else 'approved'::public.job_status end
    where id = j.id;
    perform set_config('workshopos.job_action', '', true);
    perform set_config('workshopos.job_reason', '', true);
  end if;

  perform public.log_activity(e.workshop_id, 'job_card', j.id, 'estimate.decided',
    jsonb_build_object('version', e.version, 'decision', result, 'method', p_method, 'approved_total', approved_total));
  perform public.notify_job_staff(
    j.id,
    'estimate_decision',
    format('%s: estimate %s', j.job_number,
      case result when 'approved' then 'approved' when 'rejected' then 'declined' else 'partly approved' end),
    format('%s of %s lines approved · version %s', cardinality(approved_ids), item_count, e.version)
  );
  return result;
end;
$$;

-- Customer, from the link. No login: the token is the secret.
create or replace function public.respond_to_estimate(p_token text, p_approved uuid[], p_customer_name text)
returns public.estimate_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.estimates;
  who text := nullif(btrim(coalesce(p_customer_name, '')), '');
begin
  select * into e from public.estimates
  where approval_token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');
  if e.id is null then
    raise exception 'link_invalid' using errcode = 'P0002';
  end if;
  if e.status <> 'sent' then
    raise exception 'already_decided' using errcode = '55000';
  end if;
  if e.approval_expires_at < now() then
    raise exception 'link_expired' using errcode = '55000';
  end if;
  if who is null or char_length(who) < 2 then
    raise exception 'name_required' using errcode = '22023';
  end if;
  return public.apply_estimate_decision(e.id, p_approved, 'link', left(who, 120), null, null);
end;
$$;

-- Staff record a decision the customer gave in person, by phone or on WhatsApp.
create or replace function public.record_estimate_decision(
  p_estimate uuid,
  p_approved uuid[],
  p_method public.decision_method,
  p_note text default null
)
returns public.estimate_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.estimates;
  customer text;
begin
  select * into e from public.estimates where id = p_estimate;
  if e.id is null or not public.has_workshop_permission(e.workshop_id, 'estimates.manage') then
    raise exception 'Estimate not found' using errcode = 'P0002';
  end if;
  if p_method = 'link' then
    raise exception 'Use in_person, phone or whatsapp' using errcode = '22023';
  end if;
  select c.name into customer from public.job_cards j join public.customers c on c.id = j.customer_id where j.id = e.job_card_id;
  return public.apply_estimate_decision(e.id, p_approved, p_method, customer,
    nullif(btrim(coalesce(p_note, '')), ''), (select auth.uid()));
end;
$$;

-- Everything the customer's approval page needs, and nothing more:
-- no customer phone, email or address, no cost prices, no internal notes.
create or replace function public.get_estimate_for_customer(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'workshop', jsonb_build_object('name', w.name, 'phone', w.phone, 'city', w.city, 'currency', w.currency, 'timezone', w.timezone),
    'job_number', j.job_number,
    'vehicle', jsonb_build_object('registration', v.registration_number, 'make', v.make, 'model', v.model),
    'customer_first_name', split_part(btrim(c.name), ' ', 1),
    'complaint', j.complaint,
    'estimate', jsonb_build_object(
      'version', e.version, 'status', e.status, 'sent_at', e.sent_at, 'decided_at', e.decided_at,
      'expires_at', e.approval_expires_at, 'expired', e.approval_expires_at < now(),
      'subtotal', e.subtotal, 'discount_total', e.discount_total, 'tax_label', e.tax_label,
      'tax_rate', e.tax_rate, 'tax_total', e.tax_total, 'total', e.total,
      'estimated_completion', e.estimated_completion, 'terms', e.terms, 'customer_note', e.customer_note
    ),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'kind', i.kind, 'source', i.source, 'inspection_category', i.inspection_category,
        'description', i.description, 'quantity', i.quantity, 'unit_price', i.unit_price,
        'discount', i.discount, 'line_total', i.line_total, 'taxable', i.taxable,
        'approval_status', i.approval_status
      ) order by i.position, i.created_at)
      from public.estimate_items i where i.estimate_id = e.id
    ), '[]'::jsonb),
    'findings', coalesce((
      select jsonb_agg(jsonb_build_object('category', ii.category, 'outcome', ii.outcome, 'notes', ii.notes) order by ii.category)
      from public.job_inspections ji
      join public.job_inspection_items ii on ii.inspection_id = ji.id
      where ji.job_card_id = j.id and ji.completed_at is not null
        and ii.outcome in ('needs_attention', 'requires_repair')
    ), '[]'::jsonb),
    'decision', (
      select jsonb_build_object('method', d.method, 'customer_name', d.customer_name, 'approved_total', d.approved_total, 'decided_at', d.decided_at)
      from public.estimate_decisions d where d.estimate_id = e.id order by d.decided_at desc limit 1
    )
  )
  from public.estimates e
  join public.job_cards j on j.id = e.job_card_id
  join public.workshops w on w.id = e.workshop_id
  join public.vehicles v on v.id = j.vehicle_id
  join public.customers c on c.id = j.customer_id
  where e.approval_token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');
$$;

-- ---------------------------------------------------------------------------
-- Row-level security and grants
-- ---------------------------------------------------------------------------

alter table public.labour_items enable row level security;
alter table public.parts enable row level security;
alter table public.job_inspections enable row level security;
alter table public.job_inspection_items enable row level security;
alter table public.estimates enable row level security;
alter table public.estimate_items enable row level security;
alter table public.estimate_decisions enable row level security;
alter table public.notifications enable row level security;

create policy "staff read labour catalogue" on public.labour_items for select to authenticated
  using (public.has_any_workshop_permission(workshop_id, array['estimates.manage', 'workshop.settings', 'invoices.manage']));
create policy "owners add labour" on public.labour_items for insert to authenticated
  with check (public.has_workshop_permission(workshop_id, 'workshop.settings'));
create policy "owners edit labour" on public.labour_items for update to authenticated
  using (public.has_workshop_permission(workshop_id, 'workshop.settings'))
  with check (public.has_workshop_permission(workshop_id, 'workshop.settings'));

create policy "staff read parts" on public.parts for select to authenticated
  using (public.has_any_workshop_permission(workshop_id, array['estimates.manage', 'workshop.settings', 'inventory.manage', 'invoices.manage']));
create policy "owners and inventory add parts" on public.parts for insert to authenticated
  with check (public.has_any_workshop_permission(workshop_id, array['workshop.settings', 'inventory.manage']));
create policy "owners and inventory edit parts" on public.parts for update to authenticated
  using (public.has_any_workshop_permission(workshop_id, array['workshop.settings', 'inventory.manage']))
  with check (public.has_any_workshop_permission(workshop_id, array['workshop.settings', 'inventory.manage']));

create policy "staff read inspections" on public.job_inspections for select to authenticated
  using (public.has_any_workshop_permission(workshop_id, array['jobs.manage', 'estimates.manage', 'invoices.manage', 'payments.record']));
create policy "staff read inspection items" on public.job_inspection_items for select to authenticated
  using (public.has_any_workshop_permission(workshop_id, array['jobs.manage', 'estimates.manage', 'invoices.manage', 'payments.record']));
create policy "staff record inspection items" on public.job_inspection_items for update to authenticated
  using (public.has_workshop_permission(workshop_id, 'jobs.manage'))
  with check (public.has_workshop_permission(workshop_id, 'jobs.manage'));

create policy "staff read estimates" on public.estimates for select to authenticated
  using (public.has_any_workshop_permission(workshop_id, array['estimates.manage', 'jobs.manage', 'invoices.manage', 'payments.record']));
create policy "staff edit draft estimates" on public.estimates for update to authenticated
  using (public.has_workshop_permission(workshop_id, 'estimates.manage'))
  with check (public.has_workshop_permission(workshop_id, 'estimates.manage'));

create policy "staff read estimate lines" on public.estimate_items for select to authenticated
  using (public.has_any_workshop_permission(workshop_id, array['estimates.manage', 'jobs.manage', 'invoices.manage', 'payments.record']));
create policy "staff add estimate lines" on public.estimate_items for insert to authenticated
  with check (public.has_workshop_permission(workshop_id, 'estimates.manage'));
create policy "staff edit estimate lines" on public.estimate_items for update to authenticated
  using (public.has_workshop_permission(workshop_id, 'estimates.manage'))
  with check (public.has_workshop_permission(workshop_id, 'estimates.manage'));
create policy "staff remove estimate lines" on public.estimate_items for delete to authenticated
  using (public.has_workshop_permission(workshop_id, 'estimates.manage'));

create policy "staff read decisions" on public.estimate_decisions for select to authenticated
  using (public.has_any_workshop_permission(workshop_id, array['estimates.manage', 'jobs.manage', 'invoices.manage', 'payments.record']));

create policy "people read their notifications" on public.notifications for select to authenticated
  using (recipient_id = (select auth.uid()) and public.is_workshop_member(workshop_id));
create policy "people mark their notifications read" on public.notifications for update to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));

revoke all on public.labour_items, public.parts, public.job_inspections, public.job_inspection_items,
  public.estimates, public.estimate_items, public.estimate_decisions, public.notifications from anon, authenticated;

grant select on public.labour_items, public.parts, public.job_inspections, public.job_inspection_items,
  public.estimates, public.estimate_items, public.estimate_decisions, public.notifications to authenticated;

grant insert (workshop_id, name, description, default_price, estimated_minutes, is_active) on public.labour_items to authenticated;
grant update (name, description, default_price, estimated_minutes, is_active) on public.labour_items to authenticated;
grant insert (workshop_id, name, part_number, brand, category, supplier, cost_price, selling_price, unit, is_active)
  on public.parts to authenticated;
grant update (name, part_number, brand, category, supplier, cost_price, selling_price, unit, is_active)
  on public.parts to authenticated;
grant update (outcome, notes) on public.job_inspection_items to authenticated;
grant update (estimated_completion, terms, customer_note) on public.estimates to authenticated;
grant insert (workshop_id, estimate_id, position, kind, source, inspection_category, description, labour_item_id,
  part_id, part_number, quantity, unit_price, discount, taxable) on public.estimate_items to authenticated;
grant update (position, description, quantity, unit_price, discount, taxable) on public.estimate_items to authenticated;
grant delete on public.estimate_items to authenticated;
grant update (read_at) on public.notifications to authenticated;

grant execute on function public.start_inspection(uuid) to authenticated;
grant execute on function public.complete_inspection(uuid, text) to authenticated;
grant execute on function public.create_estimate(uuid, text) to authenticated;
grant execute on function public.send_estimate(uuid, integer) to authenticated;
grant execute on function public.renew_estimate_link(uuid, integer) to authenticated;
grant execute on function public.record_estimate_decision(uuid, uuid[], public.decision_method, text) to authenticated;
grant execute on function public.respond_to_estimate(text, uuid[], text) to anon, authenticated;
grant execute on function public.get_estimate_for_customer(text) to anon, authenticated;
