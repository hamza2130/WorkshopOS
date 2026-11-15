# 15 · Mechanic "My jobs" (phone view)

**Phase 5 · Built**

## What it does

A phone-first screen for mechanics: the vehicles they have work on, what to do next, and everything they
need to do it — without prices or customer contact details. From here they start, block and complete
their tasks, record parts they fitted, take photos and leave notes for the team.

## Who can use it

- `jobs.view_assigned` (mechanics, owners). Mechanics land here after logging in (`/dashboard` and
  `/jobs` redirect them); their navigation shows only **My jobs**.
- A mechanic only sees jobs where at least one task is assigned to them.

## Screens

| Route | Purpose |
| --- | --- |
| `/my-jobs` | Cards per vehicle: registration, make/model/colour, job status, **next task**, open/blocked counts, priority, due time (amber when overdue). Filter **Current** (default) or **Include finished** |
| `/my-jobs/[id]` | Tasks (yours first, with large Start / Blocked / Mark done / Resume buttons), customer complaint and check-in observations, odometer, fuel, engine, promised time, approved work (no prices), inspection findings, parts used, photos, notes for the team |

## How it works

- The list comes from `rpc my_assigned_jobs(ws, include_closed)`, ordered by: jobs with open work first,
  then priority, then promised time.
- The job view comes from `rpc get_assigned_job(job)`, which returns only: job number, status, complaint,
  observations, check-in mileage and fuel, promised time, advisor name, vehicle details, inspection
  findings that need work, and the approved lines of the latest approved estimate (description, type,
  quantity, part number). No prices, totals, customer name, phone or address.
- Tasks, parts used, notes and photos use the same components as the advisor's Work card.
- **Photos:** mechanics can add photos (default type *Inspection finding*); only advisors remove them.
- **Notes:** mechanics' notes are always *staff only*. They see the job's staff-only notes, not notes
  written for the customer.
- Banners: *On hold* ("ask the advisor before continuing") and *Quality check / Ready* ("work is finished").

## Rules

- Mechanics can add notes, photos and parts only while the job is open (not delivered or cancelled) and
  they have a task on it (`can_work_on_job()`).
- Everything a mechanic does is attributed to them on the job's timeline.

## Data

No new tables; see [tasks](14-tasks-and-assignment.md) and [parts used](16-parts-used.md).

## Security

- Mechanics still can't read `customers`, `job_cards`, `estimates` or prices directly. The two read
  functions are `SECURITY DEFINER` and check the assignment themselves; other workshops' jobs return
  nothing.
- New RLS policies: assigned mechanics can read the job's tasks, task history, parts used, staff-only
  notes and attachments, and add staff-only notes and attachments. Storage reads and uploads for the
  job's folder follow the same rule.
- `is_assigned_to_job(job)`: the signed-in user has a task on the job and holds `jobs.view_assigned`.

## Code

`src/app/(app)/my-jobs/page.tsx`, `src/app/(app)/my-jobs/[id]/page.tsx`, `src/components/tasks/`,
`src/lib/navigation.ts`, mechanic redirects in `src/app/(app)/dashboard/page.tsx` and
`src/app/(app)/jobs/page.tsx`.

## Tests

`tests/rls/tasks.test.ts` → "what mechanics can see": only assigned jobs are listed or readable; the job
view contains no prices, totals or customer details; notes and parts only on assigned jobs, staff-only
notes only; other workshops get nothing.

## Not yet built

- Offline mode (not needed: workshops have Wi-Fi).
- Voice notes and Urdu interface (later, if customers ask).
- Mechanic-led inspections from the phone.
