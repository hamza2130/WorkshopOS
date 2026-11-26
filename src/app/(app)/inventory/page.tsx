import type { Metadata } from "next";
import Link from "next/link";
import { SearchBox } from "@/components/list-controls";
import { Badge, buttonClass, Card, cx, PageHeader } from "@/components/ui";
import { requirePageAccess } from "@/lib/auth/session";
import { formatQty, INVENTORY_VIEWS, stockLevel, STOCK_LEVEL_LABELS, STOCK_LEVEL_TONES, type InventoryView } from "@/lib/inventory";
import { formatMoney } from "@/lib/money";
import { str, withParams } from "@/lib/params";
import { createClient } from "@/lib/supabase/server";
import { PartForm } from "../settings/catalogue/catalogue-forms";

export const metadata: Metadata = { title: "Inventory" };

export default async function InventoryPage({ searchParams }: PageProps<"/inventory">) {
  const ctx = await requirePageAccess("inventory.manage");
  const sp = await searchParams;
  const viewParam = str(sp, "view");
  const view: InventoryView = viewParam in INVENTORY_VIEWS ? (viewParam as InventoryView) : "all";
  const q = str(sp, "q").trim().toLowerCase().slice(0, 60);
  const cur = ctx.workshop.currency;

  // A workshop's parts list is hundreds of rows, not millions: load it once and filter here.
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("parts")
    .select("id, name, part_number, brand, category, unit, cost_price, selling_price, track_stock, stock_on_hand, reorder_level, location")
    .eq("workshop_id", ctx.workshop.workshopId)
    .eq("is_active", true)
    .order("name")
    .limit(2000);
  if (error) throw error;

  const parts = data.map((p) => {
    const row = { ...p, stock_on_hand: Number(p.stock_on_hand), reorder_level: p.reorder_level == null ? null : Number(p.reorder_level) };
    return { ...row, level: stockLevel(row) };
  });
  const tracked = parts.filter((p) => p.track_stock);
  const needsStock = tracked.filter((p) => p.level !== "ok");
  const value = tracked.reduce((sum, p) => sum + Math.max(p.stock_on_hand, 0) * Number(p.cost_price ?? 0), 0);

  const shown = parts
    .filter((p) => (view === "low" ? p.track_stock && p.level !== "ok" : view === "untracked" ? !p.track_stock : true))
    .filter((p) => !q || [p.name, p.part_number, p.brand, p.category, p.location].some((s) => s?.toLowerCase().includes(q)));

  return (
    <>
      <PageHeader
        title="Inventory"
        description="Stock changes only by receiving, counting, or using parts on jobs."
        actions={
          ctx.permissions.has("workshop.settings") ? (
            <Link href="/settings/catalogue" className={buttonClass("secondary")}>
              Labour and parts catalogue
            </Link>
          ) : null
        }
      />

      <details className="mb-6 rounded-lg bg-white ring-1 ring-slate-200">
        <summary className="cursor-pointer px-6 py-3 text-sm font-medium text-brand-700">Add a part</summary>
        <div className="border-t border-slate-200 p-6">
          <PartForm />
        </div>
      </details>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Card className="px-4 py-3">
          <p className="text-sm text-slate-600">Parts tracked</p>
          <p className="text-2xl font-semibold tabular-nums text-slate-900">{tracked.length}</p>
        </Card>
        <Link href="/inventory?view=low" className="block rounded-lg bg-white px-4 py-3 ring-1 ring-slate-200 hover:ring-slate-300">
          <p className="text-sm text-slate-600">Low or out of stock</p>
          <p className={cx("text-2xl font-semibold tabular-nums", needsStock.length ? "text-amber-800" : "text-slate-900")}>{needsStock.length}</p>
        </Link>
        <Card className="px-4 py-3">
          <p className="text-sm text-slate-600">Stock value at cost</p>
          <p className="text-2xl font-semibold tabular-nums text-slate-900">{formatMoney(value, cur)}</p>
        </Card>
      </div>

      <nav aria-label="Inventory views" className="mb-4 flex flex-wrap gap-1 border-b border-slate-200">
        {(Object.keys(INVENTORY_VIEWS) as InventoryView[]).map((key) => (
          <Link
            key={key}
            href={withParams("/inventory", { view: key === "all" ? undefined : key, q })}
            aria-current={key === view ? "page" : undefined}
            className={cx(
              "-mb-px border-b-2 px-3 py-2 text-sm",
              key === view ? "border-brand-600 font-medium text-brand-900" : "border-transparent text-slate-600 hover:text-slate-900",
            )}
          >
            {INVENTORY_VIEWS[key].label}
          </Link>
        ))}
      </nav>

      <div className="mb-4">
        <SearchBox action="/inventory" q={q} placeholder="Name, part number, brand or shelf" hidden={view !== "all" ? { view } : {}} />
      </div>

      <Card className="overflow-hidden">
        {shown.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-600">
            {parts.length === 0 ? (
              <>
No parts yet. Use &ldquo;Add a part&rdquo; above, then receive or count its stock.
              </>
            ) : q ? (
              <>No parts match &ldquo;{q}&rdquo;.</>
            ) : view === "low" ? (
              "Nothing is low. Set a reorder level on a part to be warned before it runs out."
            ) : (
              "No parts here."
            )}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium sm:px-6">Part</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium sm:px-6">On hand</th>
                  <th scope="col" className="hidden px-6 py-2.5 text-right font-medium md:table-cell">Reorder at</th>
                  <th scope="col" className="hidden px-6 py-2.5 font-medium lg:table-cell">Shelf</th>
                  <th scope="col" className="hidden px-6 py-2.5 font-medium sm:table-cell">State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shown.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 sm:px-6">
                      <Link href={`/inventory/${p.id}`} className="font-medium text-slate-900 hover:text-brand-700 hover:underline">
                        {p.name}
                      </Link>
                      <span className="block text-xs text-slate-500">
                        {[p.part_number, p.brand].filter(Boolean).join(" · ") || "—"}
                      </span>
                    </td>
                    <td className={cx("px-4 py-3 text-right tabular-nums sm:px-6", p.stock_on_hand < 0 ? "font-semibold text-red-700" : "text-slate-900")}>
                      {p.track_stock ? `${formatQty(p.stock_on_hand)} ${p.unit}` : "—"}
                      <span className="block sm:hidden">
                        {p.level !== "ok" ? <Badge tone={STOCK_LEVEL_TONES[p.level]}>{STOCK_LEVEL_LABELS[p.level]}</Badge> : null}
                      </span>
                    </td>
                    <td className="hidden px-6 py-3 text-right tabular-nums text-slate-600 md:table-cell">
                      {p.reorder_level != null ? formatQty(p.reorder_level) : "—"}
                    </td>
                    <td className="hidden px-6 py-3 text-slate-600 lg:table-cell">{p.location ?? "—"}</td>
                    <td className="hidden px-6 py-3 sm:table-cell">
                      <Badge tone={STOCK_LEVEL_TONES[p.level]}>{STOCK_LEVEL_LABELS[p.level]}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
