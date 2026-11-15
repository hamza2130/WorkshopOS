-- Phase 3: job cards, a status workflow with a permanent timestamped history,
-- job notes and photo/document attachments.
--
-- A job's status can only change through change_job_status(), which validates
-- the move against job_status_actions. A trigger writes every change to
-- job_status_history, and a guard rejects any status update that didn't come
-- through that function, so no status change can ever go unrecorded.

create type public.job_status as enum (
  'draft', 'awaiting_inspection', 'awaiting_estimate', 'awaiting_approval', 'approved',
  'awaiting_assignment', 'in_progress', 'on_hold', 'quality_check', 'ready_for_delivery',
  'delivered', 'cancelled'
);
create type public.fuel_level as enum ('empty', 'quarter', 'half', 'three_quarters', 'full');

create or replace function public.try_uuid(p text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return p::uuid;
exception when others then
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Allowed status moves. Data, not code: the job screen lists the actions
-- available from the current status, and change_job_status() only accepts these.
-- ---------------------------------------------------------------------------

create table public.job_status_actions (
  code text not null,
  label text not null,
  from_status public.job_status not null,
  to_status public.job_status, -- null: return to the status the job had before going on hold
  requires_reason boolean not null default false,
  permission text not null default 'jobs.manage',
  tone text not null default 'secondary' check (tone in ('primary', 'secondary', 'danger')),
  sort_order smallint not null default 10,
  primary key (code, from_status)
);

insert into public.job_status_actions (code, label, from_status, to_status, requires_reason, tone, sort_order) values
  ('check_in', 'Check in vehicle', 'draft', 'awaiting_inspection', false, 'primary', 1),
  ('complete_inspection', 'Inspection complete', 'awaiting_inspection', 'awaiting_estimate', false, 'primary', 1),
  ('skip_inspection', 'Skip inspection', 'awaiting_inspection', 'awaiting_estimate', true, 'secondary', 2),
  ('send_estimate', 'Estimate sent to customer', 'awaiting_estimate', 'awaiting_approval', false, 'primary', 1),
  ('record_approval', 'Customer approved', 'awaiting_approval', 'approved', false, 'primary', 1),
  ('revise_estimate', 'Customer wants changes', 'awaiting_approval', 'awaiting_estimate', true, 'secondary', 2),
  ('request_assignment', 'Ready to assign', 'approved', 'awaiting_assignment', false, 'primary', 1),
  ('start_work', 'Start work', 'awaiting_assignment', 'in_progress', false, 'primary', 1),
  ('finish_work', 'Work complete — quality check', 'in_progress', 'quality_check', false, 'primary', 1),
  ('request_additional_work', 'Additional work found', 'in_progress', 'awaiting_estimate', true, 'secondary', 2),
  ('pass_quality_check', 'Quality check passed', 'quality_check', 'ready_for_delivery', false, 'primary', 1),
  ('fail_quality_check', 'Send back for rework', 'quality_check', 'in_progress', true, 'secondary', 2),
  ('deliver', 'Deliver to customer', 'ready_for_delivery', 'delivered', false, 'primary', 1),
  ('resume', 'Resume', 'on_hold', null, false, 'primary', 1);

insert into public.job_status_actions (code, label, from_status, to_status, requires_reason, tone, sort_order)
select 'put_on_hold', 'Put on hold', s, 'on_hold', true, 'secondary', 50
from unnest(array[
  'awaiting_inspection', 'awaiting_estimate', 'awaiting_approval', 'approved',
  'awaiting_assignment', 'in_progress', 'quality_check', 'ready_for_delivery'
]::public.job_status[]) s;

insert into public.job_status_actions (code, label, from_status, to_status, requires_reason, tone, sort_order)
select 'cancel', 'Cancel job', s, 'cancelled', true, 'danger', 99
from unnest(array[
  'draft', 'awaiting_inspection', 'awaiting_estimate', 'awaiting_approval', 'approved',
  'awaiting_assignment', 'in_progress', 'on_hold', 'quality_check', 'ready_for_delivery'
]::public.job_status[]) s;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.job_cards (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops (id) on delete restrict,
  job_number text not null default '', -- always replaced by guard_job_card() on insert
  customer_id uuid not null,
  vehicle_id uuid not null,
  status public.job_status not null default 'draft',
  status_changed_at timestamptz not null default now(),
  on_hold_from public.job_status,
  check_in_at timestamptz not null default now(),
  check_in_mileage integer check (check_in_mileage between 0 and 3000000),
  fuel_level public.fuel_level,
  complaint text not null check (char_length(btrim(complaint)) between 3 and 4000),
  initial_observations text check (char_length(initial_observations) <= 4000),
  service_advisor_id uuid references public.profiles (id),
  expected_delivery_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workshop_id, job_number),
  unique (workshop_id, id),
  foreign key (workshop_id, customer_id) references public.customers (workshop_id, id) on delete restrict,
  foreign key (workshop_id, vehicle_id) references public.vehicles (workshop_id, id) on delete restrict
);

-- Append-only. Written only by the trigger on job_cards.
create table public.job_status_history (
  id bigint generated always as identity primary key,
  workshop_id uuid not null,
  job_card_id uuid not null,
  from_status public.job_status,
  to_status public.job_status not null,
  action text not null,
  reason text,
  changed_by uuid references public.profiles (id),
  changed_at timestamptz not null default clock_timestamp(),
  foreign key (workshop_id, job_card_id) references public.job_cards (workshop_id, id) on delete restrict
);

create table public.job_notes (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null,
  job_card_id uuid not null,
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  visibility text not null default 'internal' check (visibility in ('internal', 'customer')),
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default clock_timestamp(),
  foreign key (workshop_id, job_card_id) references public.job_cards (workshop_id, id) on delete restrict
);

create table public.job_attachments (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null,
  job_card_id uuid not null,
  storage_path text not null unique,
  file_name text not null check (char_length(file_name) between 1 and 200),
  content_type text not null check (
    content_type in ('image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf')
  ),
  size_bytes integer not null check (size_bytes between 1 and 10485760),
  category text not null default 'vehicle_photo' check (category in ('vehicle_photo', 'damage_photo', 'document')),
  caption text check (char_length(caption) <= 300),
  uploaded_by uuid references public.profiles (id) default auth.uid(),
  uploaded_at timestamptz not null default clock_timestamp(),
  removed_at timestamptz,
  removed_by uuid references public.profiles (id),
  -- Files live under <workshop>/<job>/..., so the path itself can't point at another workshop's job.
  check (storage_path like workshop_id::text || '/' || job_card_id::text || '/%'),
  foreign key (workshop_id, job_card_id) references public.job_cards (workshop_id, id) on delete restrict
);

alter table public.vehicle_mileage_readings add column job_card_id uuid;
alter table public.vehicle_mileage_readings
  add constraint vehicle_mileage_readings_job_card_fkey
  foreign key (workshop_id, job_card_id) references public.job_cards (workshop_id, id) on delete restrict;

create index job_cards_workshop_status_idx on public.job_cards (workshop_id, status);
create index job_cards_workshop_check_in_idx on public.job_cards (workshop_id, check_in_at desc);
create index job_cards_vehicle_idx on public.job_cards (vehicle_id, check_in_at desc);
create index job_cards_customer_idx on public.job_cards (customer_id, check_in_at desc);
create index job_status_history_job_idx on public.job_status_history (job_card_id, id);
create index job_notes_job_idx on public.job_notes (job_card_id, created_at);
create index job_attachments_job_idx on public.job_attachments (job_card_id, uploaded_at);

create trigger job_cards_updated_at before update on public.job_cards
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Guards
-- ---------------------------------------------------------------------------

create or replace function public.guard_job_card()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_archived timestamptz;
  c_archived timestamptz;
  prefix text;
begin
  if tg_op = 'INSERT' then
    select v.customer_id, v.archived_at into v_owner, v_archived
    from public.vehicles v where v.id = new.vehicle_id and v.workshop_id = new.workshop_id;
    select c.archived_at into c_archived from public.customers c where c.id = new.customer_id;
    if v_owner is distinct from new.customer_id then
      raise exception 'The job card customer must be the vehicle''s current owner' using errcode = '23514';
    end if;
    if v_archived is not null or c_archived is not null then
      raise exception 'Restore the archived customer or vehicle before opening a job card' using errcode = '23514';
    end if;
    select w.job_card_prefix into prefix from public.workshops w where w.id = new.workshop_id;
    new.job_number := prefix || '-' || lpad(public.next_workshop_number(new.workshop_id, 'job_card')::text, 4, '0');
    new.status_changed_at := clock_timestamp();
  else
    if new.status is distinct from old.status then
      if nullif(current_setting('workshopos.job_action', true), '') is null then
        raise exception 'status_change_not_allowed' using errcode = '42501',
          detail = 'Job status can only change through change_job_status().';
      end if;
      new.status_changed_at := clock_timestamp();
    elsif old.status in ('delivered', 'cancelled') then
      raise exception 'job_closed' using errcode = '55000',
        detail = 'Delivered and cancelled job cards can no longer be edited.';
    end if;
  end if;

  if new.service_advisor_id is not null
     and (tg_op = 'INSERT' or new.service_advisor_id is distinct from old.service_advisor_id)
     and not exists (
       select 1 from public.workshop_members m
       where m.workshop_id = new.workshop_id and m.user_id = new.service_advisor_id and m.is_active
     ) then
    raise exception 'The service advisor must be an active member of this workshop' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger job_cards_guard before insert or update on public.job_cards
  for each row execute function public.guard_job_card();

create or replace function public.record_job_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  act text := nullif(current_setting('workshopos.job_action', true), '');
  why text := nullif(current_setting('workshopos.job_reason', true), '');
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;

  insert into public.job_status_history (workshop_id, job_card_id, from_status, to_status, action, reason, changed_by)
  values (
    new.workshop_id, new.id,
    case when tg_op = 'UPDATE' then old.status end,
    new.status,
    coalesce(act, 'created'),
    why,
    (select auth.uid())
  );

  if tg_op = 'UPDATE' then
    perform public.log_activity(new.workshop_id, 'job_card', new.id, 'job_card.status_changed',
      jsonb_build_object('from', old.status, 'to', new.status, 'action', act, 'reason', why));
  end if;
  return new;
end;
$$;

create trigger job_cards_status_history after insert or update of status on public.job_cards
  for each row execute function public.record_job_status_change();

create or replace function public.guard_job_attachment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.removed_at is distinct from old.removed_at then
    if old.removed_at is not null then
      raise exception 'Removed attachments stay removed' using errcode = '55000';
    end if;
    new.removed_by := (select auth.uid());
    perform public.log_activity(new.workshop_id, 'job_card', new.job_card_id, 'job_card.attachment_removed',
      jsonb_build_object('file_name', new.file_name));
  end if;
  return new;
end;
$$;

create trigger job_attachments_guard before update on public.job_attachments
  for each row execute function public.guard_job_attachment();

-- Status fields are recorded in job_status_history, so the generic audit ignores them.
create or replace function public.audit_record_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  entity text := tg_argv[0];
  changed text[];
  act text;
  meta jsonb := '{}';
  before_row jsonb;
  after_row jsonb := to_jsonb(new);
begin
  if tg_op = 'INSERT' then
    perform public.log_activity(new.workshop_id, entity, new.id, entity || '.created', '{}');
    return new;
  end if;

  before_row := to_jsonb(old);
  select coalesce(array_agg(n.key order by n.key), '{}') into changed
  from jsonb_each(after_row) n
  join jsonb_each(before_row) o on o.key = n.key
  where n.value is distinct from o.value
    and n.key not in (
      'updated_at', 'phone_normalized', 'registration_normalized',
      'status', 'status_changed_at', 'on_hold_from', 'delivered_at', 'cancelled_at'
    );

  if cardinality(changed) = 0 then
    return new;
  end if;

  if after_row ->> 'archived_at' is not null and before_row ->> 'archived_at' is null then
    act := entity || '.archived';
  elsif after_row ->> 'archived_at' is null and before_row ->> 'archived_at' is not null then
    act := entity || '.restored';
  elsif entity = 'vehicle' and 'customer_id' = any (changed) then
    act := 'vehicle.transferred';
    meta := jsonb_build_object('from', before_row ->> 'customer_id', 'to', after_row ->> 'customer_id');
  else
    act := entity || '.updated';
    meta := jsonb_build_object('fields', changed);
  end if;

  perform public.log_activity(new.workshop_id, entity, new.id, act, meta);
  return new;
end;
$$;

create trigger job_cards_audit after insert or update on public.job_cards
  for each row execute function public.audit_record_change('job_card');

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- Opens a job card for a vehicle (and its current owner) and records the
-- check-in mileage, all in one transaction.
create or replace function public.create_job_card(
  ws uuid,
  p_vehicle uuid,
  p_complaint text,
  p_mileage integer default null,
  p_mileage_note text default null,
  p_fuel_level public.fuel_level default null,
  p_observations text default null,
  p_advisor uuid default null,
  p_expected_delivery timestamptz default null,
  p_as_draft boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid;
  job uuid;
begin
  if not public.has_workshop_permission(ws, 'jobs.manage') then
    raise exception 'You don''t have permission to open job cards' using errcode = '42501';
  end if;

  select v.customer_id into owner_id from public.vehicles v where v.id = p_vehicle and v.workshop_id = ws;
  if owner_id is null then
    raise exception 'Vehicle not found' using errcode = 'P0002';
  end if;

  perform set_config('workshopos.job_action', case when p_as_draft then 'created_as_draft' else 'checked_in' end, true);
  perform set_config('workshopos.job_reason', '', true);

  insert into public.job_cards (
    workshop_id, customer_id, vehicle_id, status, complaint, check_in_mileage, fuel_level,
    initial_observations, service_advisor_id, expected_delivery_at
  ) values (
    ws, owner_id, p_vehicle,
    case when p_as_draft then 'draft'::public.job_status else 'awaiting_inspection'::public.job_status end,
    btrim(p_complaint), p_mileage, p_fuel_level, nullif(btrim(coalesce(p_observations, '')), ''),
    coalesce(p_advisor, (select auth.uid())), p_expected_delivery
  )
  returning id into job;

  if p_mileage is not null then
    insert into public.vehicle_mileage_readings (workshop_id, vehicle_id, reading, source, note, job_card_id, recorded_by)
    values (ws, p_vehicle, p_mileage, 'job', nullif(btrim(coalesce(p_mileage_note, '')), ''), job, (select auth.uid()));
  end if;

  perform set_config('workshopos.job_action', '', true);
  return job;
end;
$$;

create or replace function public.change_job_status(
  p_job uuid,
  p_action text,
  p_expected_status public.job_status,
  p_reason text default null
)
returns public.job_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  j public.job_cards;
  a public.job_status_actions;
  target public.job_status;
  why text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  select * into j from public.job_cards where id = p_job for update;
  -- Same answer for "doesn't exist" and "not yours", so other workshops' jobs can't be probed.
  if j.id is null or not public.has_any_workshop_permission(j.workshop_id, array['jobs.manage', 'tasks.update']) then
    raise exception 'Job card not found' using errcode = 'P0002';
  end if;

  if j.status is distinct from p_expected_status then
    raise exception 'status_changed' using errcode = '40001',
      detail = format('Someone else already moved this job to %s.', j.status);
  end if;

  select * into a from public.job_status_actions where code = p_action and from_status = j.status;
  if a.code is null then
    raise exception 'invalid_transition' using errcode = '22023',
      detail = format('"%s" is not allowed while the job is %s.', p_action, j.status);
  end if;
  if not public.has_workshop_permission(j.workshop_id, a.permission) then
    raise exception 'You don''t have permission to do this' using errcode = '42501';
  end if;
  if a.requires_reason and why is null then
    raise exception 'reason_required' using errcode = '22023', detail = 'Give a reason for this change.';
  end if;

  target := coalesce(a.to_status, j.on_hold_from);
  if target is null then
    raise exception 'invalid_transition' using errcode = '22023';
  end if;

  perform set_config('workshopos.job_action', a.code, true);
  perform set_config('workshopos.job_reason', coalesce(why, ''), true);

  update public.job_cards set
    status = target,
    on_hold_from = case when target = 'on_hold' then j.status end,
    delivered_at = case when target = 'delivered' then clock_timestamp() else delivered_at end,
    cancelled_at = case when target = 'cancelled' then clock_timestamp() else cancelled_at end
  where id = p_job;

  perform set_config('workshopos.job_action', '', true);
  perform set_config('workshopos.job_reason', '', true);
  return target;
end;
$$;

-- A search term is only matched against phone numbers when it looks like one.
-- Without this, "JC-0001" or "C-0001" (4 digits) matched every phone containing "01".
create or replace function public.looks_like_phone(q text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(q, '') ~ '^[0-9+()\s.-]+$'
    and char_length(regexp_replace(coalesce(q, ''), '\D', '', 'g')) >= 4;
$$;

create or replace function public.search_vehicles(
  ws uuid,
  q text default '',
  include_archived boolean default false,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  id uuid, registration_number text, make text, model text, variant text, year smallint, colour text,
  customer_id uuid, customer_name text, customer_phone text, current_mileage integer,
  archived_at timestamptz, created_at timestamptz, total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with p as (
    select
      btrim(coalesce(q, '')) as term,
      replace(replace(replace(btrim(coalesce(q, '')), '\', '\\'), '%', '\%'), '_', '\_') as pattern,
      public.normalize_registration(q) as reg,
      public.looks_like_phone(q) as is_phone,
      public.normalize_phone(q) as digits
  )
  select
    v.id, v.registration_number, v.make, v.model, v.variant, v.year, v.colour,
    c.id, c.name, c.phone, m.reading,
    v.archived_at, v.created_at,
    count(*) over ()
  from public.vehicles v
  join public.customers c on c.id = v.customer_id
  left join lateral (
    select r.reading from public.vehicle_mileage_readings r
    where r.vehicle_id = v.id
    order by r.recorded_at desc, r.id desc
    limit 1
  ) m on true
  cross join p
  where v.workshop_id = ws
    and (include_archived or v.archived_at is null)
    and (
      p.term = ''
      or (p.reg <> '' and v.registration_normalized like '%' || p.reg || '%')
      or (v.make || ' ' || v.model || coalesce(' ' || v.variant, '')) ilike '%' || p.pattern || '%'
      or c.name ilike '%' || p.pattern || '%'
      or (p.is_phone and c.phone_normalized like '%' || p.digits || '%')
    )
  order by
    (p.term <> '' and v.registration_normalized = p.reg) desc,
    case when p.term = '' then v.created_at end desc,
    v.registration_number
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0);
$$;

create or replace function public.job_status_counts(ws uuid)
returns table (status public.job_status, job_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select j.status, count(*) from public.job_cards j where j.workshop_id = ws group by j.status;
$$;

create or replace function public.search_job_cards(
  ws uuid,
  q text default '',
  p_statuses public.job_status[] default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  id uuid, job_number text, status public.job_status, check_in_at timestamptz,
  expected_delivery_at timestamptz, status_changed_at timestamptz, complaint text,
  customer_id uuid, customer_name text, customer_phone text,
  vehicle_id uuid, registration_number text, make text, model text,
  advisor_name text, total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with p as (
    select
      btrim(coalesce(q, '')) as term,
      replace(replace(replace(btrim(coalesce(q, '')), '\', '\\'), '%', '\%'), '_', '\_') as pattern,
      public.normalize_registration(q) as reg,
      public.looks_like_phone(q) as is_phone,
      public.normalize_phone(q) as digits
  )
  select
    j.id, j.job_number, j.status, j.check_in_at, j.expected_delivery_at, j.status_changed_at, j.complaint,
    c.id, c.name, c.phone, v.id, v.registration_number, v.make, v.model,
    nullif(a.full_name, ''), count(*) over ()
  from public.job_cards j
  join public.customers c on c.id = j.customer_id
  join public.vehicles v on v.id = j.vehicle_id
  left join public.profiles a on a.id = j.service_advisor_id
  cross join p
  where j.workshop_id = ws
    and (p_statuses is null or j.status = any (p_statuses))
    and (
      p.term = ''
      or j.job_number ilike p.pattern || '%'
      or (p.reg <> '' and v.registration_normalized like '%' || p.reg || '%')
      or c.name ilike '%' || p.pattern || '%'
      or (p.is_phone and c.phone_normalized like '%' || p.digits || '%')
    )
  order by j.check_in_at desc
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0);
$$;

-- Customer list now shows total jobs and last visit.
drop function public.search_customers(uuid, text, boolean, integer, integer);
create function public.search_customers(
  ws uuid,
  q text default '',
  include_archived boolean default false,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  id uuid, code text, name text, phone text, whatsapp text, email text,
  vehicle_count bigint, job_count bigint, last_visit timestamptz,
  archived_at timestamptz, created_at timestamptz, total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with p as (
    select
      btrim(coalesce(q, '')) as term,
      replace(replace(replace(btrim(coalesce(q, '')), '\', '\\'), '%', '\%'), '_', '\_') as pattern,
      public.looks_like_phone(q) as is_phone,
      public.normalize_phone(q) as digits
  )
  select
    c.id, c.code, c.name, c.phone, c.whatsapp, c.email,
    (select count(*) from public.vehicles v where v.customer_id = c.id and v.archived_at is null),
    (select count(*) from public.job_cards j where j.customer_id = c.id and j.status <> 'cancelled'),
    (select max(j.check_in_at) from public.job_cards j where j.customer_id = c.id and j.status <> 'cancelled'),
    c.archived_at, c.created_at,
    count(*) over ()
  from public.customers c, p
  where c.workshop_id = ws
    and (include_archived or c.archived_at is null)
    and (
      p.term = ''
      or c.name ilike '%' || p.pattern || '%'
      or c.code ilike p.pattern || '%'
      or (p.is_phone and c.phone_normalized like '%' || p.digits || '%')
    )
  order by
    (p.term <> '' and c.phone_normalized = p.digits) desc,
    case when p.term = '' then c.created_at end desc,
    c.name
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0);
$$;

-- ---------------------------------------------------------------------------
-- Attachment storage: private bucket, files under <workshop>/<job>/<file>.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'job-attachments', 'job-attachments', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']
)
on conflict (id) do nothing;

create or replace function public.can_upload_job_attachment(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.job_cards j
    where j.workshop_id = public.try_uuid((storage.foldername(object_name))[1])
      and j.id = public.try_uuid((storage.foldername(object_name))[2])
      and public.has_workshop_permission(j.workshop_id, 'jobs.manage')
  );
$$;

create or replace function public.job_attachment_object_exists(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from storage.objects o where o.bucket_id = 'job-attachments' and o.name = object_name);
$$;

create policy "staff upload job attachments" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'job-attachments' and public.can_upload_job_attachment(name));

create policy "staff view job attachments" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'job-attachments'
    and public.has_any_workshop_permission(
      public.try_uuid((storage.foldername(name))[1]),
      array['jobs.manage', 'invoices.manage', 'payments.record']
    )
  );

-- ---------------------------------------------------------------------------
-- Row-level security and grants
-- ---------------------------------------------------------------------------

alter table public.job_status_actions enable row level security;
alter table public.job_cards enable row level security;
alter table public.job_status_history enable row level security;
alter table public.job_notes enable row level security;
alter table public.job_attachments enable row level security;

create policy "signed-in users read job actions" on public.job_status_actions
  for select to authenticated using (true);

create policy "staff read job cards" on public.job_cards
  for select to authenticated
  using (public.has_any_workshop_permission(workshop_id, array['jobs.manage', 'invoices.manage', 'payments.record']));
create policy "staff edit job cards" on public.job_cards
  for update to authenticated
  using (public.has_workshop_permission(workshop_id, 'jobs.manage'))
  with check (public.has_workshop_permission(workshop_id, 'jobs.manage'));

create policy "staff read job history" on public.job_status_history
  for select to authenticated
  using (public.has_any_workshop_permission(workshop_id, array['jobs.manage', 'invoices.manage', 'payments.record']));

create policy "staff read job notes" on public.job_notes
  for select to authenticated
  using (public.has_any_workshop_permission(workshop_id, array['jobs.manage', 'invoices.manage', 'payments.record']));
create policy "staff add job notes" on public.job_notes
  for insert to authenticated
  with check (public.has_workshop_permission(workshop_id, 'jobs.manage') and created_by = (select auth.uid()));

create policy "staff read job attachments" on public.job_attachments
  for select to authenticated
  using (public.has_any_workshop_permission(workshop_id, array['jobs.manage', 'invoices.manage', 'payments.record']));
create policy "staff add job attachments" on public.job_attachments
  for insert to authenticated
  with check (
    public.has_workshop_permission(workshop_id, 'jobs.manage')
    and uploaded_by = (select auth.uid())
    and public.job_attachment_object_exists(storage_path)
  );
create policy "staff remove job attachments" on public.job_attachments
  for update to authenticated
  using (public.has_workshop_permission(workshop_id, 'jobs.manage'))
  with check (public.has_workshop_permission(workshop_id, 'jobs.manage'));

revoke all on public.job_status_actions, public.job_cards, public.job_status_history,
  public.job_notes, public.job_attachments from anon, authenticated;

grant select on public.job_status_actions, public.job_cards, public.job_status_history,
  public.job_notes, public.job_attachments to authenticated;
-- No insert grant on job_cards (create_job_card only) and status is not updatable directly.
grant update (complaint, initial_observations, fuel_level, service_advisor_id, expected_delivery_at)
  on public.job_cards to authenticated;
grant insert (workshop_id, job_card_id, body, visibility) on public.job_notes to authenticated;
grant insert (workshop_id, job_card_id, storage_path, file_name, content_type, size_bytes, category, caption)
  on public.job_attachments to authenticated;
grant update (removed_at) on public.job_attachments to authenticated;

grant execute on function public.try_uuid(text) to authenticated;
grant execute on function public.looks_like_phone(text) to authenticated;
grant execute on function public.can_upload_job_attachment(text) to authenticated;
grant execute on function public.job_attachment_object_exists(text) to authenticated;
grant execute on function public.create_job_card(uuid, uuid, text, integer, text, public.fuel_level, text, uuid, timestamptz, boolean) to authenticated;
grant execute on function public.change_job_status(uuid, text, public.job_status, text) to authenticated;
grant execute on function public.job_status_counts(uuid) to authenticated;
grant execute on function public.search_job_cards(uuid, text, public.job_status[], integer, integer) to authenticated;
grant execute on function public.search_customers(uuid, text, boolean, integer, integer) to authenticated;
