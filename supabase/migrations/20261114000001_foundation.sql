-- Phase 1 foundation: workshops (tenants), profiles, memberships with roles,
-- invitations and an append-only activity log. Every table has row-level
-- security; tenant isolation is enforced here, not only in application code.

create extension if not exists pgcrypto with schema extensions;

create type public.workshop_role as enum (
  'owner', 'advisor', 'mechanic', 'inventory_manager', 'cashier'
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.workshops (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  logo_path text,
  phone text,
  email text,
  address text,
  city text,
  country text not null default 'PK',
  currency char(3) not null default 'PKR' check (currency ~ '^[A-Z]{3}$'),
  timezone text not null default 'Asia/Karachi',
  tax_label text not null default 'GST',
  tax_rate numeric(5, 2) not null default 0 check (tax_rate >= 0 and tax_rate <= 100),
  invoice_prefix text not null default 'INV' check (invoice_prefix ~ '^[A-Z0-9-]{1,10}$'),
  job_card_prefix text not null default 'JC' check (job_card_prefix ~ '^[A-Z0-9-]{1,10}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workshop_members (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops (id) on delete restrict,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.workshop_role not null,
  extra_permissions text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workshop_id, user_id)
);

create table public.workshop_invitations (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops (id) on delete restrict,
  email text not null check (email = lower(btrim(email)) and email like '%@%'),
  role public.workshop_role not null check (role <> 'owner'),
  token_hash text not null unique,
  invited_by uuid not null references public.profiles (id),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  accepted_by uuid references public.profiles (id),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops (id) on delete restrict,
  actor_id uuid references public.profiles (id),
  entity_type text not null,
  entity_id uuid,
  action text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index workshop_members_user_id_idx on public.workshop_members (user_id);
create index workshop_invitations_workshop_id_idx on public.workshop_invitations (workshop_id);
create index activity_logs_workshop_created_idx on public.activity_logs (workshop_id, created_at desc);

create trigger workshops_updated_at before update on public.workshops
  for each row execute function public.set_updated_at();
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger workshop_members_updated_at before update on public.workshop_members
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Membership helpers. SECURITY DEFINER so policies on workshop_members can
-- call them without recursing into their own RLS.
-- ---------------------------------------------------------------------------

create or replace function public.is_workshop_member(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workshop_members m
    where m.workshop_id = ws and m.user_id = (select auth.uid()) and m.is_active
  );
$$;

create or replace function public.has_workshop_role(ws uuid, roles public.workshop_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workshop_members m
    where m.workshop_id = ws and m.user_id = (select auth.uid())
      and m.is_active and m.role = any (roles)
  );
$$;

create or replace function public.shares_workshop_with(other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workshop_members mine
    join public.workshop_members theirs on theirs.workshop_id = mine.workshop_id
    where mine.user_id = (select auth.uid()) and mine.is_active and theirs.user_id = other
  );
$$;

-- Internal: only callable from other definer functions and triggers.
create or replace function public.log_activity(
  ws uuid, p_entity_type text, p_entity_id uuid, p_action text, p_metadata jsonb default '{}'
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.activity_logs (workshop_id, actor_id, entity_type, entity_id, action, metadata)
  values (ws, (select auth.uid()), p_entity_type, p_entity_id, p_action, coalesce(p_metadata, '{}'));
$$;

-- ---------------------------------------------------------------------------
-- Auth user -> profile sync
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, phone)
  values (
    new.id,
    lower(coalesce(new.email, '')),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'phone', '')
  );
  return new;
end;
$$;

create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = lower(coalesce(new.email, '')) where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
create trigger on_auth_user_email_changed after update of email on auth.users
  for each row execute function public.handle_user_email_change();

-- ---------------------------------------------------------------------------
-- Guards and audit triggers
-- ---------------------------------------------------------------------------

create or replace function public.guard_member_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'owner' and old.is_active and (new.role <> 'owner' or not new.is_active) then
    if not exists (
      select 1 from public.workshop_members m
      where m.workshop_id = old.workshop_id and m.id <> old.id and m.role = 'owner' and m.is_active
    ) then
      raise exception 'A workshop must keep at least one active owner' using errcode = 'P0001';
    end if;
  end if;

  if new.role is distinct from old.role then
    perform public.log_activity(new.workshop_id, 'workshop_member', new.id, 'member.role_changed',
      jsonb_build_object('user_id', new.user_id, 'from', old.role, 'to', new.role));
  end if;
  if new.is_active is distinct from old.is_active then
    perform public.log_activity(new.workshop_id, 'workshop_member', new.id,
      case when new.is_active then 'member.activated' else 'member.deactivated' end,
      jsonb_build_object('user_id', new.user_id));
  end if;
  if new.extra_permissions is distinct from old.extra_permissions then
    perform public.log_activity(new.workshop_id, 'workshop_member', new.id, 'member.permissions_changed',
      jsonb_build_object('user_id', new.user_id, 'from', old.extra_permissions, 'to', new.extra_permissions));
  end if;
  return new;
end;
$$;

create trigger workshop_members_guard before update on public.workshop_members
  for each row execute function public.guard_member_update();

create or replace function public.audit_workshop_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.log_activity(new.id, 'workshop', new.id, 'workshop.updated', '{}');
  return new;
end;
$$;

create trigger workshops_audit after update on public.workshops
  for each row execute function public.audit_workshop_update();

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

create or replace function public.create_workshop(
  p_name text,
  p_phone text default null,
  p_email text default null,
  p_address text default null,
  p_city text default null,
  p_country text default 'PK',
  p_currency text default 'PKR',
  p_timezone text default 'Asia/Karachi',
  p_tax_label text default 'GST',
  p_tax_rate numeric default 0,
  p_invoice_prefix text default 'INV',
  p_job_card_prefix text default 'JC'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  ws uuid;
begin
  if uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  insert into public.workshops (
    name, phone, email, address, city, country, currency, timezone,
    tax_label, tax_rate, invoice_prefix, job_card_prefix
  ) values (
    btrim(p_name), p_phone, p_email, p_address, p_city, p_country, upper(p_currency), p_timezone,
    p_tax_label, p_tax_rate, upper(p_invoice_prefix), upper(p_job_card_prefix)
  ) returning id into ws;

  insert into public.workshop_members (workshop_id, user_id, role) values (ws, uid, 'owner');
  perform public.log_activity(ws, 'workshop', ws, 'workshop.created', '{}');
  return ws;
end;
$$;

-- Returns the raw invite token once; only its SHA-256 hash is stored.
create or replace function public.create_invitation(ws uuid, p_email text, p_role public.workshop_role)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  token text := encode(extensions.gen_random_bytes(32), 'hex');
  normalized text := lower(btrim(p_email));
  inv uuid;
begin
  if not public.has_workshop_role(ws, array['owner']::public.workshop_role[]) then
    raise exception 'Only an owner can invite employees' using errcode = '42501';
  end if;
  if p_role = 'owner' then
    raise exception 'Invite as another role, then promote to owner' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.workshop_members m join public.profiles p on p.id = m.user_id
    where m.workshop_id = ws and p.email = normalized and m.is_active
  ) then
    raise exception 'This person is already an active member' using errcode = '23505';
  end if;

  update public.workshop_invitations set revoked_at = now()
  where workshop_id = ws and email = normalized and accepted_at is null and revoked_at is null;

  insert into public.workshop_invitations (workshop_id, email, role, token_hash, invited_by)
  values (ws, normalized, p_role, encode(extensions.digest(token, 'sha256'), 'hex'), (select auth.uid()))
  returning id into inv;

  perform public.log_activity(ws, 'workshop_invitation', inv, 'member.invited',
    jsonb_build_object('email', normalized, 'role', p_role));
  return token;
end;
$$;

-- Public preview for the invite page; the token itself is the secret.
create or replace function public.get_invitation(p_token text)
returns table (workshop_name text, email text, role public.workshop_role, status text)
language sql
stable
security definer
set search_path = ''
as $$
  select w.name, i.email, i.role,
    case
      when i.revoked_at is not null then 'revoked'
      when i.accepted_at is not null then 'accepted'
      when i.expires_at < now() then 'expired'
      else 'pending'
    end
  from public.workshop_invitations i
  join public.workshops w on w.id = i.workshop_id
  where i.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
$$;

create or replace function public.accept_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  inv public.workshop_invitations;
  member_email text;
begin
  if uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select * into inv from public.workshop_invitations
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
  for update;

  if inv.id is null or inv.revoked_at is not null or inv.accepted_at is not null or inv.expires_at < now() then
    raise exception 'This invitation is no longer valid' using errcode = '22023';
  end if;

  select email into member_email from public.profiles where id = uid;
  if member_email is distinct from inv.email then
    raise exception 'This invitation was sent to a different email address' using errcode = '42501';
  end if;

  insert into public.workshop_members (workshop_id, user_id, role)
  values (inv.workshop_id, uid, inv.role)
  on conflict (workshop_id, user_id) do update set role = excluded.role, is_active = true;

  update public.workshop_invitations set accepted_at = now(), accepted_by = uid where id = inv.id;
  perform public.log_activity(inv.workshop_id, 'workshop_invitation', inv.id, 'member.joined',
    jsonb_build_object('role', inv.role));
  return inv.workshop_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.workshops enable row level security;
alter table public.profiles enable row level security;
alter table public.workshop_members enable row level security;
alter table public.workshop_invitations enable row level security;
alter table public.activity_logs enable row level security;

create policy "members read their workshop" on public.workshops
  for select to authenticated using (public.is_workshop_member(id));
create policy "owners update their workshop" on public.workshops
  for update to authenticated
  using (public.has_workshop_role(id, array['owner']::public.workshop_role[]))
  with check (public.has_workshop_role(id, array['owner']::public.workshop_role[]));

create policy "read own or co-worker profiles" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.shares_workshop_with(id));
create policy "update own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "members read their workshop's members" on public.workshop_members
  for select to authenticated using (public.is_workshop_member(workshop_id));
create policy "owners update members" on public.workshop_members
  for update to authenticated
  using (public.has_workshop_role(workshop_id, array['owner']::public.workshop_role[]))
  with check (public.has_workshop_role(workshop_id, array['owner']::public.workshop_role[]));

create policy "owners read invitations" on public.workshop_invitations
  for select to authenticated
  using (public.has_workshop_role(workshop_id, array['owner']::public.workshop_role[]));
create policy "owners revoke invitations" on public.workshop_invitations
  for update to authenticated
  using (public.has_workshop_role(workshop_id, array['owner']::public.workshop_role[]))
  with check (public.has_workshop_role(workshop_id, array['owner']::public.workshop_role[]));

create policy "owners and advisors read activity" on public.activity_logs
  for select to authenticated
  using (public.has_workshop_role(workshop_id, array['owner', 'advisor']::public.workshop_role[]));
create policy "members log their own activity" on public.activity_logs
  for insert to authenticated
  with check (public.is_workshop_member(workshop_id) and actor_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Grants: deny by default, then open only what the policies above expect.
-- ---------------------------------------------------------------------------

revoke all on public.workshops, public.profiles, public.workshop_members,
  public.workshop_invitations, public.activity_logs from anon, authenticated;

grant select on public.workshops, public.profiles, public.workshop_members,
  public.workshop_invitations, public.activity_logs to authenticated;
grant update (name, logo_path, phone, email, address, city, country, currency, timezone,
  tax_label, tax_rate, invoice_prefix, job_card_prefix) on public.workshops to authenticated;
grant update (full_name, phone) on public.profiles to authenticated;
grant update (role, extra_permissions, is_active) on public.workshop_members to authenticated;
grant update (revoked_at) on public.workshop_invitations to authenticated;
grant insert (workshop_id, actor_id, entity_type, entity_id, action, metadata)
  on public.activity_logs to authenticated;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.is_workshop_member(uuid) to authenticated;
grant execute on function public.has_workshop_role(uuid, public.workshop_role[]) to authenticated;
grant execute on function public.shares_workshop_with(uuid) to authenticated;
grant execute on function public.create_workshop(text, text, text, text, text, text, text, text, text, numeric, text, text) to authenticated;
grant execute on function public.create_invitation(uuid, text, public.workshop_role) to authenticated;
grant execute on function public.accept_invitation(text) to authenticated;
grant execute on function public.get_invitation(text) to anon, authenticated;

alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
