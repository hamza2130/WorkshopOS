# WorkshopOS

Workshop management SaaS for independent automobile workshops: customer check-in to vehicle delivery.
Built in gated phases — see the build plan. **Phases 1–3 are complete:** foundations, customers and
vehicles, and job cards.

**Documentation:** feature specs and architecture/flow diagrams (PNG) are in [`docs/`](docs/README.md).

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

`npm run db:seed-dev` creates local-only test accounts in an "Alpha Motors" workshop (safe to re-run,
refuses to run against anything but the local stack):

| Email | Password | Role |
| --- | --- | --- |
| owner.alpha@example.test | Workshop2026new | Owner |
| advisor.alpha@example.test | Garage2026test | Service advisor |
| mechanic.alpha@example.test | Garage2026test | Mechanic |

`npm run db:reset` wipes the local database and re-applies migrations; run `db:seed-dev` again afterwards.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run lint` / `npm run typecheck` | ESLint / route-type generation + `tsc` |
| `npm test` | Unit tests (`src/**/*.test.ts`) |
| `npm run test:rls` | Database tests: tenant isolation, roles, duplicate rules, job status history (Phase 1–3 gates) |
| `npm run db:types` | Regenerate `src/lib/supabase/database.types.ts` after a migration |
| `npm run docs:diagrams` | Render `docs/diagrams/*.mmd` to PNG (uses your installed Chrome or Edge) |
| `npm run build` | Production build |

CI (`.github/workflows/ci.yml`) runs all of the above, including the RLS suite against a fresh Supabase.

## What's built

| Phase | Delivered | Gate (proved by a database test) |
| --- | --- | --- |
| 1 · Foundations | Auth with email confirmation, workshop onboarding, roles and extra permissions, invites by link, settings, activity log, CI | Row-level security holds across two workshops |
| 2 · Customers and vehicles | Customers with duplicate-phone protection, vehicles with unique plates and transfers, append-only mileage | A duplicate phone number is caught before save |
| 3 · Job cards | Check-in flow, 12-status workflow with reasons, permanent timeline, notes, private photo/document uploads, job board on the dashboard | Every status change is timestamped |

How each feature works, who can use it and what's still missing: [`docs/features/`](docs/features).
How the system fits together and keeps workshops apart: [`docs/architecture.md`](docs/architecture.md).

Not yet: a hosted Supabase project and production deployment.
