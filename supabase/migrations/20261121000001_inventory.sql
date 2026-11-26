-- Phase 7: inventory.
--
-- A part's stock on hand is the running total of an append-only ledger of
-- movements: stock received, parts used on a job, parts taken back off a job, and
-- counted adjustments. Nobody types a stock figure (Phase 7 gate: stock only moves
-- through a recorded movement — and on jobs only when a part is actually used,
-- never when it is estimated, approved or invoiced).
--
-- Stock may go below zero: a mechanic can fit a part that arrived before anyone
-- received it into the system. The inventory screen shows it in red until stock is
-- received or counted.

create type public.stock_movement_kind as enum ('receipt', 'consumption', 'return', 'adjustment');

alter table public.parts
  add column track_stock boolean not null default true,
  add column stock_on_hand numeric(12, 2) not null default 0,
  add column reorder_level numeric(12, 2) check (reorder_level >= 0 and reorder_level <= 1000000),
  add column location text check (char_length(location) <= 60);

-- Lets a stock movement point at the part-used entry that caused it, per workshop.
alter table public.job_parts_used add constraint job_parts_used_workshop_id_id_key unique (workshop_id, id);

create table public.stock_movements (
  id bigint generated always as identity primary key,
  workshop_id uuid not null,
  part_id uuid not null,
  kind public.stock_movement_kind not null,
  quantity numeric(12, 2) not null check (quantity <> 0), -- signed: in is positive, out negative
  balance_after numeric(12, 2) not null,
  unit_cost numeric(12, 2) check (unit_cost >= 0),
  supplier text check (char_length(supplier) <= 120),
  reference text check (char_length(reference) <= 120),
  reason text check (char_length(reason) <= 500),
  job_card_id uuid,
  part_used_id uuid,
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default clock_timestamp(),
  check (kind <> 'receipt' or quantity > 0),
  check (kind <> 'consumption' or quantity < 0),
  check (kind <> 'return' or quantity > 0),
  check (kind <> 'adjustment' or nullif(btrim(reason), '') is not null),
  check ((kind in ('consumption', 'return')) = (part_used_id is not null and job_card_id is not null)),
  foreign key (workshop_id, part_id) references public.parts (workshop_id, id) on delete restrict,
  foreign key (workshop_id, job_card_id) references public.job_cards (workshop_id, id) on delete restrict,
  foreign key (workshop_id, part_used_id) references public.job_parts_used (workshop_id, id) on delete restrict
);
create index stock_movements_part_idx on public.stock_movements (part_id, id desc);
create index stock_movements_workshop_idx on public.stock_movements (workshop_id, created_at desc);
create index stock_movements_part_used_idx on public.stock_movements (part_used_id) where part_used_id is not null;

-- ---------------------------------------------------------------------------
-- Guards
-- ---------------------------------------------------------------------------

-- Stock on hand changes only inside apply_stock_movement() (flag workshopos.stock_system),
-- for everyone, including the service key.
create or replace function public.guard_part_stock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.stock_on_hand := 0;
  elsif new.stock_on_hand is distinct from old.stock_on_hand
        and current_setting('workshopos.stock_system', true) is distinct from 'on' then
    raise exception 'stock_direct_edit' using errcode = '55000',
      detail = 'Stock changes only by receiving, counting or using parts.';
  end if;
  return new;
end;
$$;

create trigger parts_stock_guard before insert or update on public.parts
  for each row execute function public.guard_part_stock();

create or replace function public.guard_stock_movement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'stock_permanent' using errcode = '55000',
    detail = 'Stock movements are never edited or deleted. Count the stock to correct it.';
end;
$$;

create trigger stock_movements_guard before update or delete on public.stock_movements
  for each row execute function public.guard_stock_movement();

-- The stock figure is recorded in the ledger, so the catalogue's audit ignores it.
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
      'status', 'status_changed_at', 'on_hold_from', 'delivered_at', 'cancelled_at',
      'stock_on_hand'
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

-- ---------------------------------------------------------------------------
-- The one writer
-- ---------------------------------------------------------------------------

-- Tells everyone who manages stock (inventory managers, owners), except whoever
-- caused it, that a part just reached its reorder level.
create or replace function public.notify_low_stock(p_part public.parts, p_balance numeric)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (workshop_id, recipient_id, kind, title, body, link)
  select m.workshop_id, m.user_id, 'low_stock',
    format('Low stock: %s', p_part.name),
    format('%s %s left · reorder at %s', trim(to_char(p_balance, 'FM999999990.##')), p_part.unit,
      trim(to_char(p_part.reorder_level, 'FM999999990.##'))),
    '/inventory/' || p_part.id
  from public.workshop_members m
  where m.workshop_id = p_part.workshop_id and m.is_active
    and m.user_id is distinct from (select auth.uid())
    and public.member_has_permission(m.workshop_id, m.user_id, 'inventory.manage');
$$;

create or replace function public.apply_stock_movement(
  p_part uuid,
  p_kind public.stock_movement_kind,
  p_quantity numeric,
  p_unit_cost numeric default null,
  p_supplier text default null,
  p_reference text default null,
  p_reason text default null,
  p_job uuid default null,
  p_part_used uuid default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.parts;
  balance numeric(12, 2);
  movement bigint;
  previous text := coalesce(current_setting('workshopos.stock_system', true), '');
begin
  select * into p from public.parts where id = p_part for update;
  balance := p.stock_on_hand + p_quantity;

  insert into public.stock_movements (
    workshop_id, part_id, kind, quantity, balance_after, unit_cost, supplier, reference, reason, job_card_id, part_used_id
  ) values (
    p.workshop_id, p.id, p_kind, p_quantity, balance, p_unit_cost,
    nullif(btrim(coalesce(p_supplier, '')), ''), nullif(btrim(coalesce(p_reference, '')), ''),
    nullif(btrim(coalesce(p_reason, '')), ''), p_job, p_part_used
  ) returning id into movement;

  perform set_config('workshopos.stock_system', 'on', true);
  update public.parts set stock_on_hand = balance where id = p.id;
  perform set_config('workshopos.stock_system', previous, true);

  -- Only on the way down past the line, so a part sitting low doesn't notify on every use.
  if p.reorder_level is not null and p.stock_on_hand > p.reorder_level and balance <= p.reorder_level then
    perform public.notify_low_stock(p, balance);
  end if;
  return movement;
end;
$$;

-- ---------------------------------------------------------------------------
-- Parts used on jobs move stock
-- ---------------------------------------------------------------------------

create or replace function public.stock_follows_parts_used()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  tracked boolean;
  job_number text;
begin
  if new.part_id is null then
    return null;
  end if;
  if tg_op = 'INSERT' then
    select track_stock into tracked from public.parts where id = new.part_id;
    if tracked then
      perform public.apply_stock_movement(new.part_id, 'consumption', -new.quantity, null, null, null, null,
        new.job_card_id, new.id);
    end if;
  elsif new.removed_at is not null and old.removed_at is null
        and exists (select 1 from public.stock_movements s where s.part_used_id = new.id and s.kind = 'consumption') then
    select j.job_number into job_number from public.job_cards j where j.id = new.job_card_id;
    perform public.apply_stock_movement(new.part_id, 'return', new.quantity, null, null, null,
      format('Removed from %s', job_number), new.job_card_id, new.id);
  end if;
  return null;
end;
$$;

create trigger job_parts_used_stock after insert or update of removed_at on public.job_parts_used
  for each row execute function public.stock_follows_parts_used();

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

create or replace function public.receive_stock(
  p_part uuid,
  p_quantity numeric,
  p_unit_cost numeric default null,
  p_supplier text default null,
  p_reference text default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.parts;
  movement bigint;
begin
  select * into p from public.parts where id = p_part;
  if p.id is null or not public.has_workshop_permission(p.workshop_id, 'inventory.manage') then
    raise exception 'Part not found' using errcode = 'P0002';
  end if;
  if not p.track_stock then
    raise exception 'stock_not_tracked' using errcode = '55000', detail = 'Turn on stock tracking for this part first.';
  end if;
  if p_quantity is null or p_quantity <= 0 or p_quantity > 100000 or p_quantity <> round(p_quantity, 2) then
    raise exception 'quantity_invalid' using errcode = '22023';
  end if;
  if p_unit_cost is not null and (p_unit_cost < 0 or p_unit_cost <> round(p_unit_cost, 2)) then
    raise exception 'cost_invalid' using errcode = '22023';
  end if;

  movement := public.apply_stock_movement(p.id, 'receipt', p_quantity, p_unit_cost,
    coalesce(nullif(btrim(coalesce(p_supplier, '')), ''), p.supplier), p_reference);
  -- The latest purchase price becomes the part's cost.
  if p_unit_cost is not null and p_unit_cost is distinct from p.cost_price then
    update public.parts set cost_price = p_unit_cost where id = p.id;
  end if;

  perform public.log_activity(p.workshop_id, 'part', p.id, 'stock.received',
    jsonb_build_object('name', p.name, 'quantity', p_quantity, 'unit', p.unit, 'unit_cost', p_unit_cost,
      'supplier', nullif(btrim(coalesce(p_supplier, '')), ''), 'reference', nullif(btrim(coalesce(p_reference, '')), '')));
  return movement;
end;
$$;

-- Sets stock to what was physically counted; the difference is recorded with the reason.
create or replace function public.count_stock(p_part uuid, p_counted numeric, p_reason text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.parts;
  why text := nullif(btrim(coalesce(p_reason, '')), '');
  delta numeric(12, 2);
  movement bigint;
begin
  select * into p from public.parts where id = p_part for update;
  if p.id is null or not public.has_workshop_permission(p.workshop_id, 'inventory.manage') then
    raise exception 'Part not found' using errcode = 'P0002';
  end if;
  if not p.track_stock then
    raise exception 'stock_not_tracked' using errcode = '55000', detail = 'Turn on stock tracking for this part first.';
  end if;
  if p_counted is null or p_counted < 0 or p_counted > 1000000 or p_counted <> round(p_counted, 2) then
    raise exception 'quantity_invalid' using errcode = '22023';
  end if;
  if why is null then
    raise exception 'reason_required' using errcode = '22023', detail = 'Say why the stock is being corrected.';
  end if;

  delta := p_counted - p.stock_on_hand;
  if delta <> 0 then
    movement := public.apply_stock_movement(p.id, 'adjustment', delta, null, null, null, left(why, 500));
  end if;
  perform public.log_activity(p.workshop_id, 'part', p.id, 'stock.counted',
    jsonb_build_object('name', p.name, 'counted', p_counted, 'change', delta, 'unit', p.unit, 'reason', why));
  return movement;
end;
$$;

-- Parts at or below their reorder level, for the dashboard and the inventory list.
create or replace function public.low_stock_parts(ws uuid)
returns table (id uuid, name text, part_number text, unit text, stock_on_hand numeric, reorder_level numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  select p.id, p.name, p.part_number, p.unit, p.stock_on_hand, p.reorder_level
  from public.parts p
  where p.workshop_id = ws and p.is_active and p.track_stock
    and p.reorder_level is not null and p.stock_on_hand <= p.reorder_level
  order by (p.stock_on_hand - p.reorder_level), p.name;
$$;

-- ---------------------------------------------------------------------------
-- Row-level security and grants
-- ---------------------------------------------------------------------------

alter table public.stock_movements enable row level security;

create policy "stock staff read movements" on public.stock_movements for select to authenticated
  using (public.has_workshop_permission(workshop_id, 'inventory.manage'));

revoke all on public.stock_movements from anon, authenticated;
grant select on public.stock_movements to authenticated;

grant insert (track_stock, reorder_level, location) on public.parts to authenticated;
grant update (track_stock, reorder_level, location) on public.parts to authenticated;

revoke execute on function public.apply_stock_movement(uuid, public.stock_movement_kind, numeric, numeric, text, text, text, uuid, uuid)
  from public, anon, authenticated;
revoke execute on function public.notify_low_stock(public.parts, numeric) from public, anon, authenticated;
grant execute on function public.receive_stock(uuid, numeric, numeric, text, text) to authenticated;
grant execute on function public.count_stock(uuid, numeric, text) to authenticated;
grant execute on function public.low_stock_parts(uuid) to authenticated;
