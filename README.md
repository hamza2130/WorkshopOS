# WorkshopOS

Workshop management SaaS for independent automobile workshops: customer check-in to vehicle delivery.
Built in gated phases — see the build plan. **Phase 1 (foundations) is complete.**

## Stack

Next.js 16 (App Router, TypeScript, Tailwind CSS 4) · Supabase (Postgres, Auth, Storage) · Zod · Vitest.

## Run it locally

Requirements: Node 22, Docker Desktop running.

```bash
npm install
npm run db:start      # local Supabase in Docker (ports 553xx, so it can run next to other projects)
npm run db:env        # writes .env.local (app) and .env.test.local (tests only)
npm run dev           # http://localhost:3000
```

Emails (sign-up confirmation, password reset) go to the local Mailpit inbox at http://127.0.0.1:55324.

Local test accounts created during Phase 1 verification (local database only):

| Email | Password | Role |
| --- | --- | --- |
| owner.alpha@example.test | Workshop2026new | Owner of Alpha Motors |
| mechanic.alpha@example.test | Garage2026test | Mechanic at Alpha Motors |

`npm run db:reset` wipes the local database and re-applies migrations (these accounts are then gone).

## Scripts

| Script | What it does |
| --- | --- |
| `npm run lint` / `npm run typecheck` | ESLint / route-type generation + `tsc` |
| `npm test` | Unit tests (`src/**/*.test.ts`) |
| `npm run test:rls` | Tenant-isolation and role tests against the local database (the Phase 1 gate) |
| `npm run db:types` | Regenerate `src/lib/supabase/database.types.ts` after a migration |
| `npm run build` | Production build |

CI (`.github/workflows/ci.yml`) runs all of the above, including the RLS suite against a fresh Supabase.

## How access control works

Three layers, so one mistake can't expose another workshop's data:

1. **Database (authoritative).** Every table has row-level security keyed on `workshop_id` and the
   caller's active membership. Grants are deny-by-default; writes to memberships and invitations go
   through checked functions (`create_workshop`, `create_invitation`, `accept_invitation`).
   The app only ever uses the anon key with the user's session — never the service-role key.
2. **Server.** Every server action calls `requirePermission(...)`; every protected page calls
   `requirePageAccess(...)` (404 if not allowed). Role → permission mapping lives in
   `src/lib/auth/permissions.ts`; owners can grant extra permissions per employee.
3. **UI.** Navigation only shows what the role can use. This is convenience, not security.

`src/proxy.ts` refreshes the session and redirects signed-out visitors; it is an optimistic check only.

Notes:

- Next.js `cacheComponents` is turned off on purpose: every signed-in page renders fresh, RLS-filtered
  data per request, so there is no server cache that could leak one workshop's data into another's.
- Timestamps are stored in UTC and shown in the workshop's time zone.
- Every significant change is written to `activity_logs` (append-only; owners and advisors can read it).

## Phase 1 status

Done: auth (register with email confirmation, login, logout, password reset), workshop onboarding with
Pakistan defaults, roles and permissions, employee invites by link (copy or WhatsApp share), role changes,
extra permissions, deactivation with a last-owner guard, workshop settings, activity log, app shell, CI.

Not yet: logo upload, editing your own profile, a hosted Supabase project and production deployment.
