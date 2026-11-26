# 03 · Roles and permissions

**Phases 1–2 · Built** (mechanic access added in Phase 5)

## What it does

Each person's membership in a workshop has one **role**. A role grants a set of **permissions**; the
owner can grant individual employees **extra permissions** on top of their role. Permissions decide what
appears in the navigation, which pages open, which actions succeed, and which rows the database returns.

## Roles and their permissions

| Permission | Owner | Advisor | Mechanic | Inventory | Cashier |
| --- | :-: | :-: | :-: | :-: | :-: |
| `dashboard.view` | ✓ | ✓ | | ✓ | ✓ |
| `workshop.settings` | ✓ | | | | |
| `staff.manage` *(owner only)* | ✓ | | | | |
| `subscription.manage` *(owner only)* | ✓ | | | | |
| `activity.view` | ✓ | ✓ | | | |
| `customers.manage` | ✓ | ✓ | | | |
| `vehicles.manage` | ✓ | ✓ | | | |
| `jobs.manage` | ✓ | ✓ | | | |
| `jobs.view_assigned` | ✓ | | ✓ | | |
| `tasks.update` | ✓ | | ✓ | | |
| `estimates.manage` | ✓ | ✓ | | | |
| `inventory.manage` | ✓ | | | ✓ | |
| `invoices.manage` | ✓ | | | | ✓ |
| `payments.record` | ✓ | | | | ✓ |
| `reports.operational` | ✓ | ✓ | | | |
| `reports.financial` | ✓ | | | | ✓ |

Owner-only permissions can never be granted as extras (enforced in code and by a database check constraint).

## Who can see what data

| Data | Can read | Can change |
| --- | --- | --- |
| Customers | `customers.manage`, `invoices.manage`, `payments.record` | `customers.manage` |
| Vehicles, mileage | `vehicles.manage`, `invoices.manage`, `payments.record` | `vehicles.manage` |
| Job cards, history, notes, attachments | `jobs.manage`, `invoices.manage`, `payments.record` | `jobs.manage` |
| Inspections | `jobs.manage`, `estimates.manage`, `invoices.manage`, `payments.record` | `jobs.manage` |
| Estimates, lines, decisions | `estimates.manage`, `jobs.manage`, `invoices.manage`, `payments.record` | `estimates.manage` (decisions only via the customer link or "record decision") |
| Labour and parts catalogue | `estimates.manage`, `workshop.settings`, `invoices.manage` (+ `inventory.manage` for parts) | `workshop.settings` (+ `inventory.manage` for parts) |
| Tasks, task history | `jobs.manage`, `invoices.manage`, `payments.record`; mechanics on jobs where they have a task | details: `jobs.manage`; status: assignee or `jobs.manage` via `update_task_status` |
| Invoices, lines, payments | `invoices.manage`, `payments.record`, `jobs.manage` (advisors read-only) | drafts and lines: `invoices.manage`; issue, void, refund: `invoices.manage` via functions; payments: `payments.record` via `record_payment` — see [invoices](17-invoices-and-payments.md) |
| Parts used | as tasks, plus `inventory.manage` | advisors; assigned mechanics while the job is open |
| Assigned job view (vehicle, complaint, findings, approved work — no prices or customer details) | `jobs.view_assigned` on jobs where they have a task, via `get_assigned_job` | — |
| Notifications | the recipient only | written by the system only |
| Activity log | Owner, advisor | written by the system only |

Mechanics never see customers, prices or estimates. Since Phase 5 they see the vehicle, complaint,
inspection findings and approved work of jobs where they have a task (see
[My jobs](15-mechanic-my-jobs.md)), and can add staff-only notes, photos and parts there. Inventory
managers can't see customers.

## How it works

- **App:** `src/lib/auth/permissions.ts` defines roles, permissions and `permissionsFor(role, extras)`.
  `getWorkshopContext()` computes the user's permissions once per request.
- **Pages:** `requirePageAccess(...)` → 404 if none of the listed permissions are held.
- **Actions:** `requirePermission(...)` → refused if not held; `requireAnyPermission(...)` for actions
  shared by several roles (e.g. notes by advisors and mechanics), where the database decides which rows.
- **Navigation:** `visibleNav()` hides sections the user can't use (convenience only).
- **Database:** the same matrix lives in the `role_permissions` table. RLS calls
  `has_workshop_permission()` / `has_any_workshop_permission()`, which include extra permissions.

## Rules

- A workshop must always keep at least one active owner (trigger `guard_member_update`).
- Owners are never invited directly; invite someone in another role, then promote them.
- Deactivated members lose access immediately; their history stays.

## Data

- `workshop_members`: `workshop_id`, `user_id`, `role`, `extra_permissions text[]`, `is_active`.
- `role_permissions`: `role`, `permission` (read-only reference table).

## Code

`src/lib/auth/permissions.ts`, `src/lib/auth/session.ts`, `src/lib/navigation.ts`,
`supabase/migrations/*` (`role_permissions`, `has_*` functions, RLS policies).

## Tests

- `src/lib/auth/permissions.test.ts`, `src/lib/navigation.test.ts`.
- `tests/rls/customers-vehicles.test.ts` → "database and app agree on the role → permission matrix":
  fails if the TypeScript matrix and the database table drift apart.
- Role checks for mechanics, cashiers and inventory managers in all three database suites.

## Not yet built

- Custom roles defined by the workshop.
- A per-employee "view only" mode.
