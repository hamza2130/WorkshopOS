-- Phase 5 follow-up: cancelling a job cancels its open tasks.
--
-- Before this, a cancelled job kept its To do / In progress / Blocked tasks forever, so they showed up
-- as open work under "Include finished" and in counts. Now the job's cancellation reason is copied to
-- each open task's history ("Job cancelled: <reason>") and the assigned mechanics are told.

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
    -- Cancelling a job closes its open tasks in the same transaction; nothing else may touch them.
    if j.status in ('delivered', 'cancelled')
       and current_setting('workshopos.task_action', true) is distinct from 'job_cancelled' then
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

create or replace function public.cancel_tasks_with_job()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  why text := nullif(current_setting('workshopos.job_reason', true), '');
begin
  if new.status <> 'cancelled' or old.status = 'cancelled' then
    return null;
  end if;

  -- Tell each mechanic who still had open work on the job (not whoever cancelled it).
  insert into public.notifications (workshop_id, recipient_id, kind, title, body, link)
  select distinct new.workshop_id, t.assignee_id, 'job_cancelled',
    format('%s: job cancelled', new.job_number), coalesce(why, 'The job was cancelled.'), '/my-jobs/' || new.id
  from public.job_tasks t
  where t.job_card_id = new.id
    and t.status in ('pending', 'in_progress', 'blocked')
    and t.assignee_id is not null
    and t.assignee_id is distinct from (select auth.uid());

  perform set_config('workshopos.task_action', 'job_cancelled', true);
  perform set_config('workshopos.task_reason', 'Job cancelled' || coalesce(': ' || why, ''), true);
  update public.job_tasks
  set status = 'cancelled', blocked_reason = null, blocked_at = null
  where job_card_id = new.id and status in ('pending', 'in_progress', 'blocked');
  perform set_config('workshopos.task_action', '', true);
  perform set_config('workshopos.task_reason', '', true);
  return null;
end;
$$;

create trigger job_cards_cancel_tasks after update of status on public.job_cards
  for each row execute function public.cancel_tasks_with_job();
