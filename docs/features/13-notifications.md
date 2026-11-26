# 13 · In-app notifications

**Phases 4–6 · Built**

## What it does

Tells staff when something needs their attention without them watching the screen. For now: a
customer's decision on an estimate, new work for a mechanic, a blocked task, all tasks finished, and an invoice paid in full. The bell in the header shows the unread count; the list is at
`/notifications`.

## Who gets what

| Event | Recipients |
| --- | --- |
| Customer decides on an estimate (link, or recorded by staff) | The job's service advisor and every active owner, except whoever made the change |
| A task is assigned or reassigned to someone | That person (not when they assign it to themselves); opens their [My jobs](15-mechanic-my-jobs.md) view |
| A task is blocked | The job's service advisor and every active owner, except whoever blocked it — with the reason |
| A job is cancelled while tasks are open | Each mechanic who still had open work on it (not whoever cancelled it) — with the job's reason |
| The last open task is completed or cancelled | The job's service advisor and every active owner, except whoever made the change — "ready for quality check" |
| A payment clears an invoice's balance | The job's service advisor and every active owner, except whoever recorded it — "paid in full", so the car can be handed back |

## How it works

`notify_job_staff()` is called inside the decision, task and payment functions, and assignment notices come from
the task trigger, all in the same transaction, so the event can't happen without its notification. Opening a notification marks it read and goes to the job card;
**Mark all as read** clears the rest.

## Data

`notifications`: `workshop_id`, `recipient_id`, `kind`, `title`, `body`, `link`, `created_at`, `read_at`.

## Security

People can read and mark only their own notifications, in workshops where they're active members.
Nobody can create them directly.

## Code

`src/app/(app)/notifications/`, bell in `src/app/(app)/layout.tsx`.

## Tests

`tests/rls/tasks.test.ts` → "tells the advisor what is blocking the work", "notifies the mechanic about
new work", and the "all tasks complete" check in "won't send a job to quality check while tasks are open".

`tests/rls/estimates.test.ts` → "notifies the service advisor and owners, privately": recipients
correct, the acting person excluded, mechanics get nothing, nobody can mark someone else's as read.

## Not yet built

- More events: estimate link expiring, job overdue, task overdue, job ready for delivery (later phases).
- Grouping several new tasks on one job into a single notification.
- Push / email / WhatsApp delivery.
