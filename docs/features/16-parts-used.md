# 16 · Parts used

**Phase 5 · Built (stock deduction in Phase 7)**

## What it does

Records which parts actually went into the vehicle, how many, by whom and for which task. This is the
basis for invoicing what was really used (Phase 6) and for deducting stock (Phase 7).

## Who can use it

- **Record:** advisors on any open job; mechanics on jobs where they have a task.
- **Remove an entry:** advisors, or the person who recorded it.
- **Read:** `jobs.manage`, `inventory.manage`, `invoices.manage`, `payments.record`, and assigned mechanics.

## Screens

**Parts used** card on the job card and on the mechanic's job view: the list (quantity × part, task,
who, when, note) and a short form — pick an **approved part** from the estimate (quantity pre-filled) or
**Something else** and describe it, then quantity, optional task and note.

## How it works

- Picking an approved part links the entry to that estimate line and its catalogue part.
- Mechanics never see the priced catalogue, so they can't pick catalogue parts directly; they pick
  approved parts or describe the part. Advisors can link a catalogue part.
- Entries can't be edited. A mistake is fixed by **Remove** (kept in the activity log) and recording again.

## Rules

- Quantity between 0.01 and 100,000, up to two decimals (e.g. 0.5 L of fluid).
- The task, if given, must be on the same job. The estimate line must be an approved *part* line of
  this job.
- Not allowed on delivered or cancelled jobs.

## Data

`job_parts_used`: `job_card_id`, `task_id`, `estimate_item_id`, `part_id`, `description`, `quantity`,
`note`, `recorded_by`, `recorded_at`, `removed_at`, `removed_by`. Activity log: `part_used.recorded`,
`part_used.removed`.

## Security

Inserts are limited to the columns above and checked by `guard_job_part_used()` (job access, task and
line belong to the job, attribution forced to the signed-in user). Only `removed_at` can be updated, once.

## Code

`src/components/tasks/parts-used.tsx`, `recordPartUsed` / `removePartUsed` in
`src/app/(app)/jobs/task-actions.ts`, migration `20261118000001_mechanic_tasks.sql`.

## Tests

`tests/rls/tasks.test.ts` → "lets assigned mechanics add internal notes and parts, nowhere else":
approved part, free text, wrong job refused, edits refused, removal attributed.

Since Phase 6, parts recorded here that weren't on the approved estimate are offered on the draft
invoice with a one-tap *Add to invoice* — see [invoices](17-invoices-and-payments.md).

## Not yet built

- Stock deduction and low-stock alerts (Phase 7).
