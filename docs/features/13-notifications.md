# 13 · In-app notifications

**Phase 4 · Built**

## What it does

Tells staff when something needs their attention without them watching the screen. For now: a
customer's decision on an estimate. The bell in the header shows the unread count; the list is at
`/notifications`.

## Who gets what

| Event | Recipients |
| --- | --- |
| Customer decides on an estimate (link, or recorded by staff) | The job's service advisor and every active owner, except whoever made the change |

## How it works

`notify_job_staff()` is called inside the decision function, in the same transaction, so a decision
can't happen without its notification. Opening a notification marks it read and goes to the job card;
**Mark all as read** clears the rest.

## Data

`notifications`: `workshop_id`, `recipient_id`, `kind`, `title`, `body`, `link`, `created_at`, `read_at`.

## Security

People can read and mark only their own notifications, in workshops where they're active members.
Nobody can create them directly.

## Code

`src/app/(app)/notifications/`, bell in `src/app/(app)/layout.tsx`.

## Tests

`tests/rls/estimates.test.ts` → "notifies the service advisor and owners, privately": recipients
correct, the acting person excluded, mechanics get nothing, nobody can mark someone else's as read.

## Not yet built

- More events: estimate link expiring, job overdue, job ready for delivery (later phases).
- Push / email / WhatsApp delivery.
