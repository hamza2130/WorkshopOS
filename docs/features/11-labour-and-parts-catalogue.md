# 11 · Labour and parts catalogue

**Phase 4 · Built (stock levels arrive with Inventory in Phase 7)**

## What it does

The workshop's saved services (with standard price and time) and parts (with selling price, optional
cost price and unit). Picking one on an estimate fills in the description and price in one click.

## Who can use it

- **Manage:** owners (`workshop.settings`). Parts can also be managed by inventory managers.
- **Read:** anyone who prepares estimates or handles invoices. Mechanics don't see it.

## Screens

| Route | Purpose |
| --- | --- |
| `/settings/catalogue` | Add, edit and hide labour services and parts (Settings → Labour and parts) |
| Estimate editor | "From your services" / "From your parts" pickers |

## Rules

| Field | Rule |
| --- | --- |
| Service name | 2–120 characters, unique per workshop (case and spaces ignored) |
| Price | 0 or more, up to 2 decimals, commas allowed when typing |
| Minutes | optional whole number |
| Part | name required; number, brand, category, supplier optional; unit defaults to *piece* |
| Cost price | optional; never shown to customers |

Items are **hidden**, not deleted, so old estimates keep their links. Prices on an estimate are copied
when the line is added; changing the catalogue later never changes a sent estimate.

## Data

- `labour_items`: `name`, `description`, `default_price`, `estimated_minutes`, `is_active`.
- `parts`: `name`, `part_number`, `brand`, `category`, `supplier`, `cost_price`, `selling_price`,
  `unit`, `is_active`. Phase 7 adds stock and movements to this table.

## Security

Per-workshop RLS; only owners (and inventory managers for parts) can write. The customer approval page
never includes cost prices. A database test checks the page's data doesn't contain `cost_price`.

## Code

`src/app/(app)/settings/catalogue/`, `src/app/(app)/settings/settings-tabs.tsx`, `src/lib/estimates.ts`
(`labourSchema`, `partSchema`), `src/lib/money.ts`.

## Tests

`tests/rls/estimates.test.ts` → "catalogues": owner can add; advisors read but can't add; cashier reads
parts; mechanic sees nothing; duplicate names refused; other workshops see nothing.
`src/lib/estimates.test.ts`, `src/lib/money.test.ts` for validation and money parsing.

## Not yet built

- Stock levels, receipts and consumption (Phase 7).
- Supplier price lists, bulk import.
