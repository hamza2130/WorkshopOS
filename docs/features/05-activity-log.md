# 05 · Activity log

**Phases 1–4 · Built**

## What it does

A newest-first feed of every significant change in the workshop: who did it, what changed, and when, in
the workshop's time zone. Names link to the customer, vehicle or job card involved.

## Who can use it

Users with `activity.view` — owners and service advisors. Reached from **Employees → Activity log** or
`/activity`.

## Events recorded

| Area | Events |
| --- | --- |
| Workshop | created, settings updated |
| Staff | invited, joined, role changed, extra permissions changed, deactivated, reactivated |
| Customers | created, updated (with field names), archived, restored, shared phone confirmed |
| Vehicles | created, updated, archived, restored, transferred (from → to owner), duplicate plate allowed (with reason) |
| Job cards | opened, details updated, status changed (from → to, with reason), attachment removed |
| Inspections and estimates | inspection completed; estimate version started (with revision reason), sent, new link issued, decided (shown as "Customer responded…" when it came from the link) |
| Catalogue | labour service or part added or updated |

Job status changes also have their own, more detailed timeline on each job card
(see [job cards](08-job-cards.md)).

## How it works

Entries are written **by the database**, not by the app: triggers (`audit_record_change`,
`guard_member_update`, `record_job_status_change`, `guard_job_attachment`) and checked functions call
the internal `log_activity()` function. A change can't happen without its log entry, and a client can't
skip or forge one.

## Data

`activity_logs`: `workshop_id`, `actor_id`, `entity_type`, `entity_id`, `action`, `metadata jsonb`,
`created_at`.

## Security

- Readable only by owners and advisors of that workshop.
- Clients may insert only entries about themselves in their own workshop; nobody can update or delete.

## Code

`src/app/(app)/activity/page.tsx`; triggers in `supabase/migrations/`.

## Tests

Database tests confirm role changes, shared-phone confirmations, duplicate-plate overrides and vehicle
transfers are logged with the right details, and that another workshop's log can't be read or written.

## Not yet built

- Filtering by person, record or date.
- CSV export (Phase 9 reporting).
