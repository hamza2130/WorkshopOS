# 09 · Dashboard

**Phases 1–3 · Built (job board); finance and stock tiles come later**

## What it does

The first screen after login. It shows what's happening in the workshop right now and offers the most
common actions.

## Who can use it

Everyone in the workshop. Content depends on permissions.

## What's on it

| Section | Shown to | Content |
| --- | --- | --- |
| Quick actions | by permission | New job card, New customer, Find vehicle |
| In the workshop now | `jobs.manage` | Count of vehicles in the workshop, and a tile per stage (awaiting inspection → ready for delivery, plus on hold), each linking to the filtered job list; drafts not yet checked in |
| Get your workshop ready | owners, until done | Create workshop ✓, invite your team, review tax and numbering settings |
| Placeholder | roles without job access | "Your work will appear here…" |

## How it works

Counts come from `rpc job_status_counts(ws)`, which runs under the user's own permissions, so a role
that can't see job cards gets no counts. Tiles link to `/jobs?status=<status>`.

## Rules

The PRD requires **invoiced revenue and cash collected to be shown separately, never labelled as the
same thing**. This applies when finance tiles arrive in Phase 6.

## Code

`src/app/(app)/dashboard/page.tsx`.

## Not yet built

- Today's invoiced amount and payments collected (Phase 6).
- Outstanding balances (Phase 6) and low-stock alerts (Phase 7).
- Date range and employee filters (Phase 9).
