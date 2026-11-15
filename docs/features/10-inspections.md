# 10 · Vehicle inspections

**Phase 4 · Built**

## What it does

A structured check of 13 areas of the vehicle at the start of a job. Each area gets an outcome and an
optional note. Findings that need work become recommended lines on the estimate and are shown to the
customer with it.

## Who can use it

- **Record and complete:** `jobs.manage` — owners and advisors. Mechanics join in Phase 5.
- **Read:** anyone who can read job cards or estimates.

## Screens

| Route | Purpose |
| --- | --- |
| `/jobs/[id]/inspection` | Start, record (all 13 areas on one page), save progress, complete; read-only once complete |
| Job card | "Start / Continue inspection" as the next step; inspection summary card |

## How it works

1. **Start.** `rpc start_inspection(job)` creates the inspection and one row per category, all
   *Not inspected*. Starting twice returns the same inspection.
2. **Record.** For each category: *Normal*, *Needs attention*, *Requires repair* or *Not inspected*,
   plus a note (e.g. "front pads at 2 mm"). **Save progress** writes only what changed, attributed to
   the person saving.
3. **Complete.** **Save and complete inspection** saves, then `rpc complete_inspection(job, summary)`
   locks the inspection and, if the job is *Awaiting inspection*, moves it to *Awaiting estimate*
   (timeline: "Inspection complete").
4. **Use the findings.** On the estimate, each *Needs attention* / *Requires repair* finding has
   **Add to estimate**, which creates a recommended line linked to that category. The customer's approval
   page lists these findings in plain words.

Quick jobs can still use **Skip inspection** (with a reason) on the job card — see [job cards](08-job-cards.md).

## Categories

Engine · Transmission · Brakes · Suspension · Steering · Electrical system · Battery · Tyres · Cooling
system · Air conditioning · Fluids · Exterior · Interior.

## Rules

- One inspection per job card. It can't be started on drafts, delivered or cancelled jobs.
- Completed inspections can't be edited (trigger `guard_inspection_item`).
- Notes ≤ 1,000 characters; summary ≤ 2,000.
- AI suggestions will never be shown as inspection findings (PRD rule for Phase 8).

## Data

- `job_inspections`: `job_card_id` (unique), `started_by`, `completed_at`, `completed_by`, `summary`.
- `job_inspection_items`: `category`, `outcome`, `notes`, `updated_by`, `updated_at`.
- Inspection photos use job attachments with the type *Inspection finding*.

## Security

Rows are only created by `start_inspection()`; clients can update only `outcome` and `notes`, only in
their own workshop, only with `jobs.manage`, and only until completion.

## Code

`src/app/(app)/jobs/[id]/inspection/` (page, `inspection-form.tsx`, `actions.ts`), `src/lib/estimates.ts`
(labels), migration `20261117000001_inspections_estimates.sql`.

## Tests

`tests/rls/estimates.test.ts` → "inspections": 13 categories created; updates attributed; mechanics
can't record; completing moves the job and locks the items; completing twice is refused; other
workshops can't start one.

## Not yet built

- Per-category photo upload inside the form (photos go in the job's attachments for now).
- Mechanic-led inspections on the phone view (Phase 5).
- Workshop-specific checklists.
