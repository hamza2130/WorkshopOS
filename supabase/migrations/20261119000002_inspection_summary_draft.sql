-- "Save progress" on an inspection now keeps the summary too. Before this, the
-- summary was only written by complete_inspection(), so anything typed and saved
-- as progress was lost on reload. Once the inspection is completed it is frozen.

create or replace function public.guard_job_inspection()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.completed_at is not null then
    raise exception 'inspection_completed' using errcode = '55000',
      detail = 'Completed inspections can no longer be changed.';
  end if;
  return new;
end;
$$;

create trigger job_inspections_guard before update on public.job_inspections
  for each row execute function public.guard_job_inspection();

create policy "staff draft inspection summary" on public.job_inspections for update to authenticated
  using (public.has_workshop_permission(workshop_id, 'jobs.manage'))
  with check (public.has_workshop_permission(workshop_id, 'jobs.manage'));

grant update (summary) on public.job_inspections to authenticated;
