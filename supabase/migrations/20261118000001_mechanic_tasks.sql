-- Phase 5: mechanic assignment and execution.
--
-- Advisors split approved work into tasks, each assigned to a mechanic with a
-- priority and an expected time. Mechanics see only the jobs they are assigned
-- to (no prices, no customer contact details), and start, block or complete
-- their tasks, add notes and photos, and record the parts they used.
--
-- Gate: a blocked task always records a reason. A CHECK constraint on the task,
-- a CHECK constraint on its append-only history, and update_task_status() all
-- refuse a block without one, so no path — app, API or SQL — can skip it.

create type public.task_status as enum ('pending', 'in_progress', 'blocked', 'completed', 'cancelled');
create type public.task_priority as enum ('low', 'normal', 'high', 'urgent');

-- The first task started moves an approved job into work automatically.
insert into public.job_status_actions (code, label, from_status, to_status, requires_reason, permission, tone, sort_order) values
  ('work_started', 'Work started', 'approved', 'in_progress', false, 'system', 'primary', 90),
  ('work_started', 'Work started', 'awaiting_assignment', 'in_progress', false, 'system', 'primary', 90);

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.job_tasks (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null,
  job_card_id uuid not null,
  estimate_item_id uuid,
  position integer not null default 0,
  title text not null check (char_length(btrim(title)) between 2 and 200),
  description text check (char_length(description) <= 2000),
  assignee_id uuid references public.profiles (id),
  priority public.task_priority not null default 'normal',
  expected_completion_at timestamptz,
  status public.task_status not null default 'pending',
  blocked_reason text check (char_length(blocked_reason) <= 1000),
  blocked_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  status_changed_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default now(),
  unique (workshop_id, id),
  -- The Phase 5 gate.
  constraint job_tasks_blocked_needs_reason
    check (status <> 'blocked' or nullif(btrim(blocked_reason), '') is not null),
  constraint job_tasks_work_needs_assignee
    check (status in ('pending', 'cancelled') or assignee_id is not null),
  foreign key (workshop_id, job_card_id) references public.job_cards (workshop_id, id) on delete restrict
);

-- Append-only. Written only by the trigger on job_tasks.
create table public.job_task_history (
  id bigint generated always as identity primary key,
  workshop_id uuid not null,
  task_id uuid not null,
  job_card_id uuid not null,
  from_status public.task_status,
  to_status public.task_status not null,
  reason text,
  changed_by uuid references public.profiles (id),
  changed_at timestamptz not null default clock_timestamp(),
  constraint job_task_history_blocked_needs_reason
    check (to_status <> 'blocked' or nullif(btrim(reason), '') is not null),
  foreign key (workshop_id, task_id) references public.job_tasks (workshop_id, id) on delete restrict,
  foreign key (workshop_id, job_card_id) references public.job_cards (workshop_id, id) on delete restrict
);

-- What was fitted. Phase 7 turns these into stock movements.
create table public.job_parts_used (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null,
  job_card_id uuid not null,
  task_id uuid,
  estimate_item_id uuid,
  part_id uuid,
  description text not null check (char_length(btrim(description)) between 1 and 300),
  quantity numeric(10, 2) not null check (quantity > 0 and quantity <= 100000),
  note text check (char_length(note) <= 500),
  recorded_by uuid references public.profiles (id) default auth.uid(),
  recorded_at timestamptz not null default clock_timestamp(),
  removed_at timestamptz,
  removed_by uuid references public.profiles (id),
  foreign key (workshop_id, job_card_id) references public.job_cards (workshop_id, id) on delete restrict,
  foreign key (workshop_id, task_id) references public.job_tasks (workshop_id, id) on delete restrict,
  foreign key (workshop_id, part_id) references public.parts (workshop_id, id) on delete restrict
);

create index job_tasks_job_idx on public.job_tasks (job_card_id, position, created_at);
create index job_tasks_assignee_idx on public.job_tasks (assignee_id, status);
create index job_task_history_task_idx on public.job_task_history (task_id, id);
create index job_task_history_job_idx on public.job_task_history (job_card_id, id);
create index job_parts_used_job_idx on public.job_parts_used (job_card_id, recorded_at);

create trigger job_tasks_updated_at before update on public.job_tasks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Whether any (other) user holds a permission in a workshop. Internal only.
create or replace function public.member_has_permission(ws uuid, p_user uuid, perm text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workshop_members m
    where m.workshop_id = ws and m.user_id = p_user and m.is_active
      and (
        perm = any (m.extra_permissions)
        or exists (select 1 from public.role_permissions rp where rp.role = m.role and rp.permission = perm)
      )
  );
$$;

-- The signed-in user has a task on this job and may see assigned work.
create or replace function public.is_assigned_to_job(p_job uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.job_tasks t
    where t.job_card_id = p_job
      and t.assignee_id = (select auth.uid())
      and public.has_workshop_permission(t.workshop_id, 'jobs.view_assigned')
  );
$$;

-- Assigned mechanics may add notes, photos and parts while the job is open.
create or replace function public.can_work_on_job(p_job uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.job_cards j
    where j.id = p_job
      and j.status not in ('delivered', 'cancelled')
      and (
        public.has_workshop_permission(j.workshop_id, 'jobs.manage')
        or (public.is_assigned_to_job(j.id) and public.has_workshop_permission(j.workshop_id, 'tasks.update'))
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- Guards
-- ---------------------------------------------------------------------------

create or replace function public.guard_job_task()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  j public.job_cards;
  item_ok boolean;
begin
  select * into j from public.job_cards where id = new.job_card_id and workshop_id = new.workshop_id;

  if tg_op = 'INSERT' then
    if j.status not in ('approved', 'awaiting_assignment', 'in_progress', 'on_hold') then
      raise exception 'tasks_not_allowed' using errcode = '55000',
        detail = format('Tasks are planned once the customer has approved the work and before quality check (this job is %s).', j.status);
    end if;
    new.status := 'pending';
    new.blocked_reason := null;
    new.blocked_at := null;
    new.started_at := null;
    new.completed_at := null;
    new.status_changed_at := clock_timestamp();
    new.created_by := (select auth.uid());
    new.title := btrim(new.title);

    if new.estimate_item_id is not null then
      select exists (
        select 1 from public.estimate_items i
        join public.estimates e on e.id = i.estimate_id
        where i.id = new.estimate_item_id and e.job_card_id = new.job_card_id and i.approval_status = 'approved'
      ) into item_ok;
      if not item_ok then
        raise exception 'Tasks can only be linked to approved work on this job' using errcode = '23514';
      end if;
    end if;
  else
    if new.status is distinct from old.status then
      if nullif(current_setting('workshopos.task_action', true), '') is null then
        raise exception 'status_change_not_allowed' using errcode = '42501',
          detail = 'Task status can only change through update_task_status().';
      end if;
      new.status_changed_at := clock_timestamp();
    elsif old.status in ('completed', 'cancelled') and (
      new.title, new.description, new.assignee_id, new.priority, new.expected_completion_at
    ) is distinct from (
      old.title, old.description, old.assignee_id, old.priority, old.expected_completion_at
    ) then
      raise exception 'task_closed' using errcode = '55000',
        detail = 'Reopen the task before changing it.';
    end if;
    if j.status in ('delivered', 'cancelled') then
      raise exception 'job_closed' using errcode = '55000',
        detail = 'Delivered and cancelled job cards can no longer be edited.';
    end if;
    if new.estimate_item_id is distinct from old.estimate_item_id then
      raise exception 'The approved line a task came from can''t be changed' using errcode = '23514';
    end if;
  end if;

  if new.assignee_id is not null
     and (tg_op = 'INSERT' or new.assignee_id is distinct from old.assignee_id)
     and not public.member_has_permission(new.workshop_id, new.assignee_id, 'tasks.update') then
    raise exception 'Tasks can only be assigned to active staff who can update tasks' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger job_tasks_guard before insert or update on public.job_tasks
  for each row execute function public.guard_job_task();

create or replace function public.record_job_task_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  why text := nullif(current_setting('workshopos.task_reason', true), '');
  job_no text;
begin
  select j.job_number into job_no from public.job_cards j where j.id = new.job_card_id;

  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.job_task_history (workshop_id, task_id, job_card_id, from_status, to_status, reason, changed_by)
    values (
      new.workshop_id, new.id, new.job_card_id,
      case when tg_op = 'UPDATE' then old.status end,
      new.status,
      case when new.status = 'blocked' then new.blocked_reason else why end,
      (select auth.uid())
    );
  end if;

  if tg_op = 'INSERT' then
    perform public.log_activity(new.workshop_id, 'job_card', new.job_card_id, 'task.created',
      jsonb_build_object('task', new.title, 'assignee', new.assignee_id));
  elsif new.status is distinct from old.status then
    perform public.log_activity(new.workshop_id, 'job_card', new.job_card_id, 'task.status_changed',
      jsonb_build_object('task', new.title, 'from', old.status, 'to', new.status,
        'reason', case when new.status = 'blocked' then new.blocked_reason else why end));
  elsif new.assignee_id is distinct from old.assignee_id then
    perform public.log_activity(new.workshop_id, 'job_card', new.job_card_id, 'task.reassigned',
      jsonb_build_object('task', new.title, 'from', old.assignee_id, 'to', new.assignee_id));
  end if;

  -- Tell the mechanic about new work (not when they assign it to themselves).
  if new.assignee_id is not null
     and new.assignee_id is distinct from (select auth.uid())
     and (tg_op = 'INSERT' or new.assignee_id is distinct from old.assignee_id)
     and new.status not in ('completed', 'cancelled') then
    insert into public.notifications (workshop_id, recipient_id, kind, title, body, link)
    values (new.workshop_id, new.assignee_id, 'task_assigned',
      format('%s: new task', job_no), new.title, '/my-jobs/' || new.job_card_id);
  end if;
  return new;
end;
$$;

create trigger job_tasks_history after insert or update on public.job_tasks
  for each row execute function public.record_job_task_change();

-- A job can't go to quality check while tasks are still open.
create or replace function public.guard_job_work_finished()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  open_count integer;
begin
  if new.status = 'quality_check' and old.status is distinct from 'quality_check' then
    select count(*) into open_count from public.job_tasks
    where job_card_id = new.id and status not in ('completed', 'cancelled');
    if open_count > 0 then
      raise exception 'tasks_open' using errcode = '55000',
        detail = format('%s task(s) are not complete yet. Finish or cancel them first.', open_count);
    end if;
  end if;
  return new;
end;
$$;

create trigger job_cards_work_finished before update of status on public.job_cards
  for each row execute function public.guard_job_work_finished();

create or replace function public.guard_job_part_used()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  line public.estimate_items;
begin
  if tg_op = 'INSERT' then
    if not public.can_work_on_job(new.job_card_id) then
      raise exception 'Job card not found' using errcode = 'P0002';
    end if;
    new.recorded_by := (select auth.uid());
    new.removed_at := null;
    new.removed_by := null;
    new.description := btrim(new.description);

    if new.task_id is not null and not exists (
      select 1 from public.job_tasks t where t.id = new.task_id and t.job_card_id = new.job_card_id
    ) then
      raise exception 'That task belongs to another job' using errcode = '23514';
    end if;

    if new.estimate_item_id is not null then
      select i.* into line from public.estimate_items i
      join public.estimates e on e.id = i.estimate_id
      where i.id = new.estimate_item_id and e.job_card_id = new.job_card_id
        and i.approval_status = 'approved' and i.kind = 'part';
      if line.id is null then
        raise exception 'Pick an approved part from this job' using errcode = '23514';
      end if;
      new.part_id := line.part_id;
    elsif new.part_id is not null and not public.has_workshop_permission(new.workshop_id, 'jobs.manage') then
      -- Mechanics can't browse the priced catalogue; they pick approved parts or describe the part.
      raise exception 'Pick an approved part or describe the part' using errcode = '42501';
    end if;
  else
    if (new.job_card_id, new.task_id, new.estimate_item_id, new.part_id, new.description, new.quantity, new.note,
        new.recorded_by, new.recorded_at)
       is distinct from
       (old.job_card_id, old.task_id, old.estimate_item_id, old.part_id, old.description, old.quantity, old.note,
        old.recorded_by, old.recorded_at) then
      raise exception 'Parts records can''t be edited; remove the entry and record it again' using errcode = '55000';
    end if;
    if old.removed_at is not null then
      raise exception 'Removed entries stay removed' using errcode = '55000';
    end if;
    if new.removed_at is not null then
      if not (public.has_workshop_permission(new.workshop_id, 'jobs.manage') or old.recorded_by = (select auth.uid())) then
        raise exception 'Only the person who recorded this, or an advisor, can remove it' using errcode = '42501';
      end if;
      new.removed_at := clock_timestamp();
      new.removed_by := (select auth.uid());
      perform public.log_activity(new.workshop_id, 'job_card', new.job_card_id, 'part_used.removed',
        jsonb_build_object('description', new.description, 'quantity', new.quantity));
    end if;
    return new;
  end if;

  perform public.log_activity(new.workshop_id, 'job_card', new.job_card_id, 'part_used.recorded',
    jsonb_build_object('description', new.description, 'quantity', new.quantity));
  return new;
end;
$$;

create trigger job_parts_used_guard before insert or update on public.job_parts_used
  for each row execute function public.guard_job_part_used();

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- The only way a task's status changes.
--   pending     -> in_progress | blocked | cancelled
--   in_progress -> completed | blocked | cancelled
--   blocked     -> in_progress | cancelled
--   completed   -> in_progress   (reopen; advisors only, with a reason)
-- Blocking always needs a reason; so do cancelling and reopening.
create or replace function public.update_task_status(
  p_task uuid,
  p_status public.task_status,
  p_expected_status public.task_status,
  p_reason text default null
)
returns public.task_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.job_tasks;
  j public.job_cards;
  why text := nullif(btrim(coalesce(p_reason, '')), '');
  is_manager boolean;
  is_assignee boolean;
  remaining integer;
  actor text;
begin
  select * into t from public.job_tasks where id = p_task for update;
  if t.id is null then
    raise exception 'Task not found' using errcode = 'P0002';
  end if;
  is_manager := public.has_workshop_permission(t.workshop_id, 'jobs.manage');
  is_assignee := t.assignee_id = (select auth.uid()) and public.has_workshop_permission(t.workshop_id, 'tasks.update');
  -- Same answer for "doesn't exist" and "not yours".
  if not (is_manager or is_assignee or public.is_assigned_to_job(t.job_card_id)) then
    raise exception 'Task not found' using errcode = 'P0002';
  end if;
  if not (is_manager or is_assignee) then
    raise exception 'Only the assigned mechanic or an advisor can update this task' using errcode = '42501';
  end if;

  if t.status is distinct from p_expected_status then
    raise exception 'status_changed' using errcode = '40001',
      detail = format('Someone else already moved this task to %s.', t.status);
  end if;

  if not (
    (t.status = 'pending' and p_status in ('in_progress', 'blocked', 'cancelled'))
    or (t.status = 'in_progress' and p_status in ('completed', 'blocked', 'cancelled'))
    or (t.status = 'blocked' and p_status in ('in_progress', 'cancelled'))
    or (t.status = 'completed' and p_status = 'in_progress')
  ) then
    raise exception 'invalid_transition' using errcode = '22023',
      detail = format('A %s task can''t be moved to %s.', t.status, p_status);
  end if;

  if (p_status = 'cancelled' or t.status = 'completed') and not is_manager then
    raise exception 'Only an advisor can cancel or reopen a task' using errcode = '42501';
  end if;
  if why is null and (p_status in ('blocked', 'cancelled') or t.status = 'completed') then
    raise exception 'reason_required' using errcode = '22023',
      detail = case when p_status = 'blocked' then 'Say what is blocking this task.' else 'Give a reason for this change.' end;
  end if;
  if p_status in ('in_progress', 'blocked', 'completed') and t.assignee_id is null then
    raise exception 'unassigned' using errcode = '22023', detail = 'Assign a mechanic before work starts.';
  end if;

  select * into j from public.job_cards where id = t.job_card_id for update;
  if p_status <> 'cancelled' then
    if j.status = 'on_hold' and p_status = 'in_progress' then
      raise exception 'job_on_hold' using errcode = '55000', detail = 'The job is on hold. Resume it first.';
    end if;
    if j.status not in ('approved', 'awaiting_assignment', 'in_progress', 'on_hold') then
      raise exception 'job_not_in_work' using errcode = '55000',
        detail = format('Tasks can''t change while the job is %s.', j.status);
    end if;
  elsif j.status in ('delivered', 'cancelled') then
    raise exception 'job_closed' using errcode = '55000';
  end if;

  perform set_config('workshopos.task_action', p_status::text, true);
  perform set_config('workshopos.task_reason', coalesce(why, ''), true);
  update public.job_tasks set
    status = p_status,
    blocked_reason = case when p_status = 'blocked' then why end,
    blocked_at = case when p_status = 'blocked' then clock_timestamp() end,
    started_at = case when p_status = 'in_progress' then coalesce(started_at, clock_timestamp()) else started_at end,
    completed_at = case when p_status = 'completed' then clock_timestamp() when p_status = 'in_progress' then null else completed_at end
  where id = t.id;
  perform set_config('workshopos.task_action', '', true);
  perform set_config('workshopos.task_reason', '', true);

  select coalesce(nullif(p.full_name, ''), p.email) into actor from public.profiles p where p.id = (select auth.uid());

  -- First task started: the job is now in progress.
  if p_status = 'in_progress' and j.status in ('approved', 'awaiting_assignment') then
    perform set_config('workshopos.job_action', 'work_started', true);
    perform set_config('workshopos.job_reason', format('%s started "%s"', coalesce(actor, 'Staff'), t.title), true);
    update public.job_cards set status = 'in_progress' where id = j.id;
    perform set_config('workshopos.job_action', '', true);
    perform set_config('workshopos.job_reason', '', true);
  end if;

  if p_status = 'blocked' then
    perform public.notify_job_staff(j.id, 'task_blocked',
      format('%s: task blocked', j.job_number), format('%s — %s', t.title, why));
  end if;

  if p_status in ('completed', 'cancelled') then
    select count(*) into remaining from public.job_tasks
    where job_card_id = j.id and status not in ('completed', 'cancelled');
    if remaining = 0 and exists (select 1 from public.job_tasks where job_card_id = j.id and status = 'completed') then
      perform public.notify_job_staff(j.id, 'tasks_completed',
        format('%s: all tasks complete', j.job_number), 'Ready for quality check.');
    end if;
  end if;

  return p_status;
end;
$$;

-- One task per approved labour or other line on the job's approved estimate,
-- skipping lines that already have a task — including a cancelled one, which
-- the advisor dropped on purpose. Revisions copy lines, so matching is by description.
create or replace function public.create_tasks_from_estimate(p_job uuid, p_assignee uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  j public.job_cards;
  e public.estimates;
  base integer;
  created integer;
begin
  select * into j from public.job_cards where id = p_job;
  if j.id is null or not public.has_workshop_permission(j.workshop_id, 'jobs.manage') then
    raise exception 'Job card not found' using errcode = 'P0002';
  end if;

  select * into e from public.estimates
  where job_card_id = p_job and status in ('approved', 'partially_approved')
  order by version desc limit 1;
  if e.id is null then
    raise exception 'no_approved_estimate' using errcode = '55000', detail = 'There is no approved estimate on this job yet.';
  end if;

  select coalesce(max(position) + 1, 0) into base from public.job_tasks where job_card_id = p_job;

  insert into public.job_tasks (workshop_id, job_card_id, estimate_item_id, position, title, assignee_id)
  select j.workshop_id, p_job, i.id, base + (row_number() over (order by i.position, i.created_at))::integer - 1,
    left(i.description, 200), p_assignee
  from public.estimate_items i
  where i.estimate_id = e.id
    and i.approval_status = 'approved'
    and i.kind in ('labour', 'other')
    and char_length(btrim(i.description)) >= 2
    and not exists (
      select 1 from public.job_tasks t
      where t.job_card_id = p_job
        and lower(btrim(t.title)) = lower(btrim(left(i.description, 200)))
    );
  get diagnostics created = row_count;
  return created;
end;
$$;

-- Mechanic's job list for the active workshop: only jobs with a task for them.
create or replace function public.my_assigned_jobs(ws uuid, p_include_closed boolean default false)
returns table (
  id uuid, job_number text, status public.job_status, complaint text, expected_delivery_at timestamptz,
  registration_number text, make text, model text, colour text,
  my_open_tasks bigint, my_blocked_tasks bigint, my_total_tasks bigint,
  next_task text, top_priority public.task_priority, next_due_at timestamptz, last_activity_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    j.id, j.job_number, j.status, j.complaint, j.expected_delivery_at,
    v.registration_number, v.make, v.model, v.colour,
    count(*) filter (where t.status in ('pending', 'in_progress', 'blocked')),
    count(*) filter (where t.status = 'blocked'),
    count(*) filter (where t.status <> 'cancelled'),
    (array_agg(t.title order by (t.status = 'in_progress') desc, t.priority desc, t.position)
      filter (where t.status in ('pending', 'in_progress', 'blocked')))[1],
    max(t.priority) filter (where t.status in ('pending', 'in_progress', 'blocked')),
    min(t.expected_completion_at) filter (where t.status in ('pending', 'in_progress', 'blocked')),
    max(t.status_changed_at)
  from public.job_tasks t
  join public.job_cards j on j.id = t.job_card_id
  join public.vehicles v on v.id = j.vehicle_id
  where t.workshop_id = ws
    and t.assignee_id = (select auth.uid())
    and public.has_workshop_permission(ws, 'jobs.view_assigned')
    and (p_include_closed or j.status not in ('quality_check', 'ready_for_delivery', 'delivered', 'cancelled'))
  group by j.id, v.id
  order by
    count(*) filter (where t.status in ('pending', 'in_progress', 'blocked')) > 0 desc,
    max(t.priority) filter (where t.status in ('pending', 'in_progress', 'blocked')) desc nulls last,
    j.expected_delivery_at nulls last,
    j.check_in_at
  limit 100;
$$;

-- What a mechanic needs to do the work — and nothing else: no prices and no
-- customer contact details.
create or replace function public.get_assigned_job(p_job uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  j public.job_cards;
  result jsonb;
begin
  select * into j from public.job_cards where id = p_job;
  if j.id is null or not (
    public.is_assigned_to_job(p_job) or public.has_workshop_permission(j.workshop_id, 'jobs.manage')
  ) then
    return null;
  end if;

  select jsonb_build_object(
    'id', j.id,
    'workshop_id', j.workshop_id,
    'job_number', j.job_number,
    'status', j.status,
    'complaint', j.complaint,
    'initial_observations', j.initial_observations,
    'check_in_at', j.check_in_at,
    'check_in_mileage', j.check_in_mileage,
    'fuel_level', j.fuel_level,
    'expected_delivery_at', j.expected_delivery_at,
    'advisor', (select coalesce(nullif(p.full_name, ''), p.email) from public.profiles p where p.id = j.service_advisor_id),
    'vehicle', (
      select jsonb_build_object('registration_number', v.registration_number, 'make', v.make, 'model', v.model,
        'variant', v.variant, 'year', v.year, 'colour', v.colour, 'fuel_type', v.fuel_type, 'transmission', v.transmission)
      from public.vehicles v where v.id = j.vehicle_id
    ),
    'findings', coalesce((
      select jsonb_agg(jsonb_build_object('category', ii.category, 'outcome', ii.outcome, 'notes', ii.notes)
        order by ii.outcome desc, ii.category)
      from public.job_inspections ji
      join public.job_inspection_items ii on ii.inspection_id = ji.id
      where ji.job_card_id = j.id and ii.outcome in ('needs_attention', 'requires_repair')
    ), '[]'::jsonb),
    'approved_work', coalesce((
      select jsonb_agg(jsonb_build_object('id', i.id, 'kind', i.kind, 'description', i.description,
        'quantity', i.quantity, 'part_number', i.part_number, 'inspection_category', i.inspection_category)
        order by i.position, i.created_at)
      from public.estimate_items i
      where i.approval_status = 'approved'
        and i.estimate_id = (
          select e.id from public.estimates e
          where e.job_card_id = j.id and e.status in ('approved', 'partially_approved')
          order by e.version desc limit 1
        )
    ), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Mechanics can add notes and photos to jobs they are assigned to.
-- ---------------------------------------------------------------------------

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
      and public.can_work_on_job(j.id)
  );
$$;

drop policy "staff view job attachments" on storage.objects;
create policy "staff view job attachments" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'job-attachments'
    and (
      public.has_any_workshop_permission(
        public.try_uuid((storage.foldername(name))[1]),
        array['jobs.manage', 'invoices.manage', 'payments.record']
      )
      or public.is_assigned_to_job(public.try_uuid((storage.foldername(name))[2]))
    )
  );

create policy "assigned mechanics read job notes" on public.job_notes
  for select to authenticated
  using (visibility = 'internal' and public.is_assigned_to_job(job_card_id));
drop policy "staff add job notes" on public.job_notes;
create policy "staff add job notes" on public.job_notes
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (
      public.has_workshop_permission(workshop_id, 'jobs.manage')
      or (visibility = 'internal' and public.can_work_on_job(job_card_id))
    )
  );

create policy "assigned mechanics read job attachments" on public.job_attachments
  for select to authenticated
  using (public.is_assigned_to_job(job_card_id));
drop policy "staff add job attachments" on public.job_attachments;
create policy "staff add job attachments" on public.job_attachments
  for insert to authenticated
  with check (
    uploaded_by = (select auth.uid())
    and public.can_work_on_job(job_card_id)
    and public.job_attachment_object_exists(storage_path)
  );

-- ---------------------------------------------------------------------------
-- Row-level security and grants
-- ---------------------------------------------------------------------------

alter table public.job_tasks enable row level security;
alter table public.job_task_history enable row level security;
alter table public.job_parts_used enable row level security;

create policy "staff read job tasks" on public.job_tasks for select to authenticated
  using (
    public.has_any_workshop_permission(workshop_id, array['jobs.manage', 'invoices.manage', 'payments.record'])
    or public.is_assigned_to_job(job_card_id)
  );
create policy "advisors plan tasks" on public.job_tasks for insert to authenticated
  with check (public.has_workshop_permission(workshop_id, 'jobs.manage'));
create policy "advisors edit tasks" on public.job_tasks for update to authenticated
  using (public.has_workshop_permission(workshop_id, 'jobs.manage'))
  with check (public.has_workshop_permission(workshop_id, 'jobs.manage'));

create policy "staff read task history" on public.job_task_history for select to authenticated
  using (
    public.has_any_workshop_permission(workshop_id, array['jobs.manage', 'invoices.manage', 'payments.record'])
    or public.is_assigned_to_job(job_card_id)
  );

create policy "staff read parts used" on public.job_parts_used for select to authenticated
  using (
    public.has_any_workshop_permission(workshop_id, array['jobs.manage', 'inventory.manage', 'invoices.manage', 'payments.record'])
    or public.is_assigned_to_job(job_card_id)
  );
create policy "staff record parts used" on public.job_parts_used for insert to authenticated
  with check (public.can_work_on_job(job_card_id));
create policy "staff remove parts used" on public.job_parts_used for update to authenticated
  using (public.can_work_on_job(job_card_id))
  with check (public.can_work_on_job(job_card_id));

revoke all on public.job_tasks, public.job_task_history, public.job_parts_used from anon, authenticated;
grant select on public.job_tasks, public.job_task_history, public.job_parts_used to authenticated;
-- Status fields are not writable: update_task_status() only.
grant insert (workshop_id, job_card_id, estimate_item_id, position, title, description, assignee_id, priority, expected_completion_at)
  on public.job_tasks to authenticated;
grant update (position, title, description, assignee_id, priority, expected_completion_at)
  on public.job_tasks to authenticated;
grant insert (workshop_id, job_card_id, task_id, estimate_item_id, part_id, description, quantity, note)
  on public.job_parts_used to authenticated;
grant update (removed_at) on public.job_parts_used to authenticated;

revoke execute on function public.member_has_permission(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.is_assigned_to_job(uuid) to authenticated;
grant execute on function public.can_work_on_job(uuid) to authenticated;
grant execute on function public.update_task_status(uuid, public.task_status, public.task_status, text) to authenticated;
grant execute on function public.create_tasks_from_estimate(uuid, uuid) to authenticated;
grant execute on function public.my_assigned_jobs(uuid, boolean) to authenticated;
grant execute on function public.get_assigned_job(uuid) to authenticated;
