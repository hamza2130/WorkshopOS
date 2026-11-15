# 03 · Roles and permissions

**Phases 1–2 · Built**

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
| Notifications | the recipient only | written by the system only |
| Activity log | Owner, advisor | written by the system only |

Mechanics and inventory managers can't see customers yet. In Phase 5 mechanics will see the customer
and vehicle of jobs assigned to them.

## How it works

- **App:** `src/lib/auth/permissions.ts` defines roles, permissions and `permissionsFor(role, extras)`.
  `getWorkshopContext()` computes the user's permissions once per request.
- **Pages:** `requirePageAccess(...)` → 404 if none of the listed permissions are held.
- **Actions:** `requirePermission(...)` → refused if not held.
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
