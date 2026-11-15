# 02 · Workshop onboarding and settings

**Phase 1 · Built**

## What it does

After confirming their email, a new owner creates their workshop. The owner can later change the
workshop's profile, region, tax and document-numbering settings. A person can belong to several
workshops and switch between them.

## Who can use it

- **Onboarding:** any signed-in user without a workshop (they become its owner).
- **Settings:** users with `workshop.settings` — owners by default.

## Screens

| Route | Purpose |
| --- | --- |
| `/onboarding` | Create a workshop |
| `/settings` | Edit workshop settings |
| Header switcher | Shown when the user belongs to more than one workshop |

## How it works

1. The onboarding form shows name, phone, email, address and city; region, tax and numbering sit in a
   collapsed "Region, tax and numbering" section pre-filled with Pakistan defaults.
2. The server action validates with `workshopSchema` and calls `rpc create_workshop()`, which in **one
   transaction** inserts the workshop, makes the caller its `owner`, and logs `workshop.created`.
3. The new workshop becomes the active one (`active_workshop` cookie) and the user lands on the dashboard.
4. Settings updates go through a normal table update; RLS only allows owners, and a trigger logs
   `workshop.updated`.

## Rules

| Field | Rule | Default |
| --- | --- | --- |
| Name | 2–120 characters | — |
| Country | 2-letter code | `PK` |
| Currency | 3-letter code | `PKR` |
| Time zone | Any valid IANA zone | `Asia/Karachi` |
| Tax label / rate | label ≤ 20 chars; rate 0–100 with up to 2 decimals | `GST`, `0` |
| Invoice / job card prefix | 1–10 of A–Z, 0–9, `-`; stored uppercase | `INV`, `JC` |

The job card prefix applies to job cards created after a change; existing numbers never change.

## Data

`workshops`: `name`, `logo_path`, `phone`, `email`, `address`, `city`, `country`, `currency`,
`timezone`, `tax_label`, `tax_rate numeric(5,2)`, `invoice_prefix`, `job_card_prefix`.

## Security

- No direct insert into `workshops`; only `create_workshop()` (which also creates the owner membership).
- Update is allowed only for owners (RLS) and only on the listed columns (column grants).
- The active-workshop cookie is a preference; `getWorkshopContext()` re-checks membership every request.

## Code

`src/app/onboarding/`, `src/app/(app)/settings/`, `src/components/workshop-fields.tsx`,
`src/lib/workshop-schema.ts`, `src/lib/auth/active-workshop.ts`, `src/app/(app)/workshop-switcher.tsx`.

## Tests

`src/lib/workshop-schema.test.ts` (defaults, prefixes, time zones, tax precision). Database tests check
that owners can update their own workshop, mechanics can't, and nobody can update another workshop.

## Not yet built

- Logo upload (column exists).
- Multi-branch workshops (the data model leaves room; no branch UI in the MVP).
- Subscription and billing settings.
