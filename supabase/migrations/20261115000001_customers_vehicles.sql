-- Phase 2: customers, vehicles and mileage history.
-- Duplicate phone numbers and registration numbers are caught here, in the database,
-- so no client (UI, API or script) can bypass the check.

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Permissions in the database. Mirrors src/lib/auth/permissions.ts; the RLS
-- test suite fails if the two drift apart.
-- ---------------------------------------------------------------------------

create table public.role_permissions (
  role public.workshop_role not null,
  permission text not null,
  primary key (role, permission)
);

insert into public.role_permissions (role, permission)
select 'owner'::public.workshop_role, p from unnest(array[
  'dashboard.view', 'workshop.settings', 'staff.manage', 'activity.view', 'subscription.manage',
  'customers.manage', 'vehicles.manage', 'jobs.manage', 'jobs.view_assigned', 'tasks.update',
  'estimates.manage', 'inventory.manage', 'invoices.manage', 'payments.record',
  'reports.operational', 'reports.financial'
]) p
union all
select 'advisor', p from unnest(array[
  'dashboard.view', 'activity.view', 'customers.manage', 'vehicles.manage', 'jobs.manage',
  'estimates.manage', 'reports.operational'
]) p
union all
select 'mechanic', p from unnest(array['jobs.view_assigned', 'tasks.update']) p
union all
select 'inventory_manager', p from unnest(array['dashboard.view', 'inventory.manage']) p
union all
select 'cashier', p from unnest(array[
  'dashboard.view', 'invoices.manage', 'payments.record', 'reports.financial'
]) p;

alter table public.workshop_members add constraint workshop_members_no_owner_only_extras
  check (not (extra_permissions && array['staff.manage', 'subscription.manage']));

create or replace function public.has_any_workshop_permission(ws uuid, perms text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workshop_members m
    where m.workshop_id = ws and m.user_id = (select auth.uid()) and m.is_active
      and (
        m.extra_permissions && perms
        or exists (
          select 1 from public.role_permissions rp
          where rp.role = m.role and rp.permission = any (perms)
        )
      )
  );
$$;

create or replace function public.has_workshop_permission(ws uuid, perm text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_any_workshop_permission(ws, array[perm]);
$$;

-- ---------------------------------------------------------------------------
-- Per-workshop numbering (C-0001 now; job cards and invoices later).
-- ---------------------------------------------------------------------------

create table public.workshop_counters (
  workshop_id uuid not null references public.workshops (id) on delete restrict,
  kind text not null,
  last_value bigint not null default 0,
  primary key (workshop_id, kind)
);

create or replace function public.next_workshop_number(ws uuid, p_kind text)
returns bigint
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.workshop_counters (workshop_id, kind, last_value)
  values (ws, p_kind, 1)
  on conflict (workshop_id, kind)
  do update set last_value = public.workshop_counters.last_value + 1
  returning last_value;
$$;

-- ---------------------------------------------------------------------------
-- Normalisation. Pakistan-first: 0300 1234567, +92 300 1234567 and
-- 923001234567 are the same number. src/lib/phone.ts mirrors this.
-- ---------------------------------------------------------------------------

create or replace function public.normalize_phone(p text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case
    when d = '' then null
    when d like '00%' then substr(d, 3)
    when d like '0%' then '92' || substr(d, 2)
    when char_length(d) = 10 and d like '3%' then '92' || d
    else d
  end
  from (select regexp_replace(coalesce(p, ''), '\D', '', 'g') as d) s;
$$;

create or replace function public.normalize_registration(p text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select upper(regexp_replace(coalesce(p, ''), '[^A-Za-z0-9]', '', 'g'));
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create type public.fuel_type as enum ('petrol', 'diesel', 'cng', 'lpg', 'hybrid', 'electric', 'other');
create type public.transmission_type as enum ('manual', 'automatic', 'other');

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops (id) on delete restrict,
  code text not null default '', -- always replaced by guard_customer() on insert
  name text not null check (char_length(btrim(name)) between 1 and 120),
  phone text not null check (
    char_length(phone) <= 30 and coalesce(char_length(public.normalize_phone(phone)), 0) between 9 and 15
  ),
  phone_normalized text generated always as (public.normalize_phone(phone)) stored,
  whatsapp text check (char_length(whatsapp) <= 30),
  email text check (char_length(email) <= 254),
  address text check (char_length(address) <= 300),
  notes text check (char_length(notes) <= 2000),
  shared_phone_confirmed boolean not null default false,
  archived_at timestamptz,
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workshop_id, code),
  unique (workshop_id, id)
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops (id) on delete restrict,
  customer_id uuid not null,
  registration_number text not null check (
    char_length(registration_number) <= 20
    and char_length(public.normalize_registration(registration_number)) between 2 and 15
  ),
  registration_normalized text generated always as (public.normalize_registration(registration_number)) stored,
  make text not null check (char_length(btrim(make)) between 1 and 60),
  model text not null check (char_length(btrim(model)) between 1 and 60),
  variant text check (char_length(variant) <= 60),
  year smallint check (year between 1950 and 2100),
  engine_cc integer check (engine_cc between 50 and 10000),
  fuel_type public.fuel_type,
  transmission public.transmission_type,
  colour text check (char_length(colour) <= 40),
  vin text check (char_length(vin) <= 40),
  engine_number text check (char_length(engine_number) <= 40),
  notes text check (char_length(notes) <= 2000),
  duplicate_registration_reason text check (char_length(duplicate_registration_reason) <= 300),
  archived_at timestamptz,
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workshop_id, id),
  -- A vehicle can only belong to a customer of the same workshop.
  foreign key (workshop_id, customer_id) references public.customers (workshop_id, id) on delete restrict
);

-- Append-only: readings are never edited, so earlier mileage is never overwritten.
create table public.vehicle_mileage_readings (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null,
  vehicle_id uuid not null,
  reading integer not null check (reading between 0 and 3000000),
  source text not null default 'manual' check (source in ('registration', 'manual', 'job')),
  note text check (char_length(note) <= 300),
  recorded_by uuid references public.profiles (id) default auth.uid(),
  recorded_at timestamptz not null default now(),
  foreign key (workshop_id, vehicle_id) references public.vehicles (workshop_id, id) on delete restrict
);

create index customers_workshop_phone_idx on public.customers (workshop_id, phone_normalized);
create index customers_workshop_created_idx on public.customers (workshop_id, created_at desc);
create index customers_name_trgm_idx on public.customers using gin (name extensions.gin_trgm_ops);
create index customers_phone_trgm_idx on public.customers using gin (phone_normalized extensions.gin_trgm_ops);
create index vehicles_workshop_registration_idx on public.vehicles (workshop_id, registration_normalized);
create index vehicles_customer_idx on public.vehicles (customer_id);
create index vehicles_workshop_created_idx on public.vehicles (workshop_id, created_at desc);
create index vehicles_registration_trgm_idx on public.vehicles using gin (registration_normalized extensions.gin_trgm_ops);
create index mileage_vehicle_recorded_idx on public.vehicle_mileage_readings (vehicle_id, recorded_at desc);

create trigger customers_updated_at before update on public.customers
  for each row execute function public.set_updated_at();
create trigger vehicles_updated_at before update on public.vehicles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Guards
-- ---------------------------------------------------------------------------

create or replace function public.guard_customer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized text := public.normalize_phone(new.phone);
  others integer;
begin
  if tg_op = 'UPDATE' and new.archived_at is distinct from old.archived_at
     and not public.has_workshop_role(new.workshop_id, array['owner']::public.workshop_role[]) then
    raise exception 'Only the workshop owner can archive or restore customers' using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    new.code := 'C-' || lpad(public.next_workshop_number(new.workshop_id, 'customer')::text, 4, '0');
  end if;

  if tg_op = 'INSERT' or normalized is distinct from public.normalize_phone(old.phone) then
    -- Serialise checks for the same number so two simultaneous saves can't both pass.
    perform pg_advisory_xact_lock(hashtextextended(new.workshop_id::text || ':phone:' || coalesce(normalized, ''), 0));
    select count(*) into others
    from public.customers c
    where c.workshop_id = new.workshop_id and c.phone_normalized = normalized and c.id <> new.id;

    if others > 0 then
      if not new.shared_phone_confirmed then
        raise exception 'duplicate_phone' using errcode = '23505',
          detail = 'Another customer in this workshop already uses this phone number.';
      end if;
      perform public.log_activity(new.workshop_id, 'customer', new.id, 'customer.shared_phone_confirmed',
        jsonb_build_object('existing_customers', others));
    end if;
  end if;
  return new;
end;
$$;

create trigger customers_guard before insert or update on public.customers
  for each row execute function public.guard_customer();

create or replace function public.guard_vehicle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized text := public.normalize_registration(new.registration_number);
  existing integer;
begin
  if tg_op = 'UPDATE' and new.archived_at is distinct from old.archived_at
     and not public.has_workshop_role(new.workshop_id, array['owner']::public.workshop_role[]) then
    raise exception 'Only the workshop owner can archive or restore vehicles' using errcode = '42501';
  end if;

  if tg_op = 'INSERT' or normalized is distinct from public.normalize_registration(old.registration_number) then
    perform pg_advisory_xact_lock(hashtextextended(new.workshop_id::text || ':reg:' || normalized, 0));
    select count(*) into existing
    from public.vehicles v
    where v.workshop_id = new.workshop_id and v.registration_normalized = normalized and v.id <> new.id;

    if existing > 0 then
      -- Authorised exception path: only an owner, and only with a recorded reason.
      if nullif(btrim(coalesce(new.duplicate_registration_reason, '')), '') is null
         or not public.has_workshop_role(new.workshop_id, array['owner']::public.workshop_role[]) then
        raise exception 'duplicate_registration' using errcode = '23505',
          detail = 'Another vehicle in this workshop already has this registration number.';
      end if;
      perform public.log_activity(new.workshop_id, 'vehicle', new.id, 'vehicle.duplicate_registration_allowed',
        jsonb_build_object('registration', normalized, 'reason', new.duplicate_registration_reason));
    end if;
  end if;
  return new;
end;
$$;

create trigger vehicles_guard before insert or update on public.vehicles
  for each row execute function public.guard_vehicle();

create or replace function public.guard_mileage_reading()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  latest integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.vehicle_id::text || ':mileage', 0));
  select r.reading into latest
  from public.vehicle_mileage_readings r
  where r.vehicle_id = new.vehicle_id
  order by r.recorded_at desc, r.id desc
  limit 1;

  if latest is not null and new.reading < latest and nullif(btrim(coalesce(new.note, '')), '') is null then
    raise exception 'mileage_decrease' using errcode = '22023',
      detail = format('The last recorded reading is %s km. Add a note (e.g. odometer replaced) to record a lower one.', latest);
  end if;
  return new;
end;
$$;

create trigger mileage_guard before insert on public.vehicle_mileage_readings
  for each row execute function public.guard_mileage_reading();

-- ---------------------------------------------------------------------------
-- Audit
-- ---------------------------------------------------------------------------

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
    and n.key not in ('updated_at', 'phone_normalized', 'registration_normalized');

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

create trigger customers_audit after insert or update on public.customers
  for each row execute function public.audit_record_change('customer');
create trigger vehicles_audit after insert or update on public.vehicles
  for each row execute function public.audit_record_change('vehicle');

-- ---------------------------------------------------------------------------
-- Search (SECURITY INVOKER: row-level security still applies)
-- ---------------------------------------------------------------------------

create or replace function public.search_customers(
  ws uuid,
  q text default '',
  include_archived boolean default false,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  id uuid, code text, name text, phone text, whatsapp text, email text,
  vehicle_count bigint, archived_at timestamptz, created_at timestamptz, total_count bigint
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
      char_length(regexp_replace(coalesce(q, ''), '\D', '', 'g')) as digit_count,
      public.normalize_phone(q) as digits
  )
  select
    c.id, c.code, c.name, c.phone, c.whatsapp, c.email,
    (select count(*) from public.vehicles v where v.customer_id = c.id and v.archived_at is null),
    c.archived_at, c.created_at,
    count(*) over ()
  from public.customers c, p
  where c.workshop_id = ws
    and (include_archived or c.archived_at is null)
    and (
      p.term = ''
      or c.name ilike '%' || p.pattern || '%'
      or c.code ilike p.pattern || '%'
      or (p.digit_count >= 4 and c.phone_normalized like '%' || p.digits || '%')
    )
  order by
    (p.term <> '' and c.phone_normalized = p.digits) desc,
    case when p.term = '' then c.created_at end desc,
    c.name
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0);
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
      char_length(regexp_replace(coalesce(q, ''), '\D', '', 'g')) as digit_count,
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
      or (p.digit_count >= 4 and c.phone_normalized like '%' || p.digits || '%')
    )
  order by
    (p.term <> '' and v.registration_normalized = p.reg) desc,
    case when p.term = '' then v.created_at end desc,
    v.registration_number
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0);
$$;

-- ---------------------------------------------------------------------------
-- Row-level security. Inventory managers and mechanics get no customer access
-- yet; mechanics will see the customer and vehicle of their assigned jobs in Phase 5.
-- ---------------------------------------------------------------------------

alter table public.role_permissions enable row level security;
alter table public.workshop_counters enable row level security;
alter table public.customers enable row level security;
alter table public.vehicles enable row level security;
alter table public.vehicle_mileage_readings enable row level security;

create policy "signed-in users read the role matrix" on public.role_permissions
  for select to authenticated using (true);

create policy "staff read customers" on public.customers
  for select to authenticated
  using (public.has_any_workshop_permission(workshop_id, array['customers.manage', 'invoices.manage', 'payments.record']));
create policy "staff add customers" on public.customers
  for insert to authenticated
  with check (public.has_workshop_permission(workshop_id, 'customers.manage'));
create policy "staff update customers" on public.customers
  for update to authenticated
  using (public.has_workshop_permission(workshop_id, 'customers.manage'))
  with check (public.has_workshop_permission(workshop_id, 'customers.manage'));

create policy "staff read vehicles" on public.vehicles
  for select to authenticated
  using (public.has_any_workshop_permission(workshop_id, array['vehicles.manage', 'invoices.manage', 'payments.record']));
create policy "staff add vehicles" on public.vehicles
  for insert to authenticated
  with check (public.has_workshop_permission(workshop_id, 'vehicles.manage'));
create policy "staff update vehicles" on public.vehicles
  for update to authenticated
  using (public.has_workshop_permission(workshop_id, 'vehicles.manage'))
  with check (public.has_workshop_permission(workshop_id, 'vehicles.manage'));

create policy "staff read mileage" on public.vehicle_mileage_readings
  for select to authenticated
  using (public.has_any_workshop_permission(workshop_id, array['vehicles.manage', 'invoices.manage', 'payments.record']));
create policy "staff record mileage" on public.vehicle_mileage_readings
  for insert to authenticated
  with check (public.has_workshop_permission(workshop_id, 'vehicles.manage') and recorded_by = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on public.role_permissions, public.workshop_counters, public.customers,
  public.vehicles, public.vehicle_mileage_readings from anon, authenticated;

grant select on public.role_permissions, public.customers, public.vehicles,
  public.vehicle_mileage_readings to authenticated;

grant insert (workshop_id, name, phone, whatsapp, email, address, notes, shared_phone_confirmed)
  on public.customers to authenticated;
grant update (name, phone, whatsapp, email, address, notes, shared_phone_confirmed, archived_at)
  on public.customers to authenticated;

grant insert (workshop_id, customer_id, registration_number, make, model, variant, year, engine_cc,
  fuel_type, transmission, colour, vin, engine_number, notes, duplicate_registration_reason)
  on public.vehicles to authenticated;
grant update (customer_id, registration_number, make, model, variant, year, engine_cc, fuel_type,
  transmission, colour, vin, engine_number, notes, duplicate_registration_reason, archived_at)
  on public.vehicles to authenticated;

grant insert (workshop_id, vehicle_id, reading, source, note) on public.vehicle_mileage_readings to authenticated;

grant execute on function public.has_any_workshop_permission(uuid, text[]) to authenticated;
grant execute on function public.has_workshop_permission(uuid, text) to authenticated;
grant execute on function public.normalize_phone(text) to authenticated;
grant execute on function public.normalize_registration(text) to authenticated;
grant execute on function public.search_customers(uuid, text, boolean, integer, integer) to authenticated;
grant execute on function public.search_vehicles(uuid, text, boolean, integer, integer) to authenticated;
