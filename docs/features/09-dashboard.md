# 09 · Dashboard

**Phases 1–7 · Built (job board, money today, stock to reorder)**

## What it does

The first screen after login. It shows what's happening in the workshop right now and offers the most
common actions.

## Who can use it

Everyone with `dashboard.view` (every role except mechanics). Content depends on permissions.
Mechanics are sent to [My jobs](15-mechanic-my-jobs.md) instead.

## What's on it

| Section | Shown to | Content |
| --- | --- | --- |
| Quick actions | by permission | New job card, New customer, Find vehicle |
| In the workshop now | `jobs.manage` | Count of vehicles in the workshop, and a tile per stage (awaiting inspection → ready for delivery, plus on hold), each linking to the filtered job list; drafts not yet checked in |
| Get your workshop ready | owners, until done | Create workshop ✓, invite your team, review tax and numbering settings |
| Placeholder | roles without job access | "Your work will appear here…" |

## How it works

Counts come from `rpc job_status_counts(ws)`, which runs under the user's own permissions, so a role
that can't see job cards gets no counts. Tiles link to `/jobs?status=<status>`. Stages with no jobs
are dimmed so the busy ones stand out.

## Rules

The PRD requires **invoiced revenue and cash collected to be shown separately, never labelled as the
same thing**. Since Phase 6, owners and accountants (`invoices.manage`, `payments.record` or
`reports.financial`) see **Money today**: *Invoiced today* (issued invoices, in the workshop's time
zone), *Collected today* (payments less refunds) and *Outstanding* (every unpaid balance, all dates,
linking to the unpaid invoices). The three numbers are never added together.

Since Phase 7, owners and inventory managers see **Stock to reorder**: parts at or below their
reorder level, or at zero or below, worst first, each linking to its stock page.

## Code

`src/app/(app)/dashboard/page.tsx`.

## Not yet built

- A "needs attention" list (overdue cars, blocked tasks, old unpaid invoices) — proposed for the pilot.
- Date range and employee filters (Phase 9).
