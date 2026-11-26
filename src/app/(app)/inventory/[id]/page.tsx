import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, Badge, buttonClass, Card, cx, PageHeader } from "@/components/ui";
import { requirePageAccess } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { formatQty, MOVEMENT_LABELS, stockLevel, STOCK_LEVEL_LABELS, STOCK_LEVEL_TONES } from "@/lib/inventory";
import { formatMoney } from "@/lib/money";
import { isUuid } from "@/lib/params";
import { createClient } from "@/lib/supabase/server";
import { PartForm } from "../../settings/catalogue/catalogue-forms";
import { CountForm, ReceiveForm, StockSettingsForm } from "./stock-forms";

export const metadata: Metadata = { title: "Stock" };

export default async function PartStockPage({ params }: PageProps<"/inventory/[id]">) {
  const ctx = await requirePageAccess("inventory.manage");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const tz = ctx.workshop.timezone;
  const cur = ctx.workshop.currency;

  const supabase = await createClient();
  const [{ data: p }, { data: moves }] = await Promise.all([
    supabase.from("parts").select("*").eq("id", id).eq("workshop_id", ctx.workshop.workshopId).maybeSingle(),
    supabase
      .from("stock_movements")
      .select("id, kind, quantity, balance_after, unit_cost, supplier, reference, reason, created_at, job:job_cards(id, job_number), person:profiles!stock_movements_created_by_fkey(full_name, email)")
      .eq("part_id", id)
      .order("id", { ascending: false })
      .limit(200),
  ]);
  if (!p) notFound();

  const onHand = Number(p.stock_on_hand);
  const level = stockLevel({ track_stock: p.track_stock, stock_on_hand: onHand, reorder_level: p.reorder_level == null ? null : Number(p.reorder_level) });
  const unit = p.unit;

  return (
    <>
      <PageHeader
        title={p.name}
        description={[p.part_number, p.brand, p.category].filter(Boolean).join(" · ") || "Catalogue part"}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={STOCK_LEVEL_TONES[level]}>{STOCK_LEVEL_LABELS[level]}</Badge>
            <Link href="/inventory" className={buttonClass("secondary")}>
              All stock
            </Link>
          </div>
        }
      />

      {!p.is_active ? (
        <div className="mb-6">
          <Alert tone="info">This part is switched off in the catalogue, so it can&apos;t be added to new estimates.</Alert>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-6">
          <Card className="grid gap-4 p-6 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
            <div>
              <p className="text-sm text-slate-600">On hand</p>
              <p className={cx("text-3xl font-semibold tabular-nums", onHand < 0 ? "text-red-700" : "text-slate-900")}>
                {p.track_stock ? formatQty(onHand) : "—"} <span className="text-base font-normal text-slate-500">{unit}</span>
              </p>
              {onHand < 0 ? <p className="text-xs text-red-700">More was used than was received. Receive or count this part.</p> : null}
            </div>
            <div>
              <p className="text-sm text-slate-600">Cost / selling price</p>
              <p className="text-lg font-medium tabular-nums text-slate-900">
                {p.cost_price != null ? formatMoney(p.cost_price, cur) : "—"} / {formatMoney(p.selling_price, cur)}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-600">Value at cost</p>
              <p className="text-lg font-medium tabular-nums text-slate-900">
                {p.track_stock && p.cost_price != null ? formatMoney(Math.max(onHand, 0) * Number(p.cost_price), cur) : "—"}
              </p>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <h2 className="border-b border-slate-200 px-6 py-3 text-sm font-semibold text-slate-900">Stock movements</h2>
            {moves?.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th scope="col" className="px-4 py-2 font-medium sm:px-6">What</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">Change</th>
                      <th scope="col" className="px-4 py-2 text-right font-medium sm:px-6">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {moves.map((m) => (
                      <tr key={m.id}>
                        <td className="px-4 py-3 sm:px-6">
                          <span className="font-medium text-slate-900">{MOVEMENT_LABELS[m.kind]}</span>
                          {m.job ? (
                            <>
                              {" "}
                              <Link href={`/jobs/${m.job.id}`} className="text-brand-700 hover:underline">
                                {m.job.job_number}
                              </Link>
                            </>
                          ) : null}
                          <span className="block text-xs text-slate-500">
                            {formatDateTime(m.created_at, tz)} · {m.person?.full_name || m.person?.email || "Someone"}
                            {m.supplier ? ` · ${m.supplier}` : ""}
                            {m.reference ? ` · ${m.reference}` : ""}
                            {m.unit_cost != null ? ` · ${formatMoney(m.unit_cost, cur)} each` : ""}
                          </span>
                          {m.reason ? <span className="block text-xs text-slate-700">{m.reason}</span> : null}
                        </td>
                        <td className={cx("px-3 py-3 text-right font-medium tabular-nums", Number(m.quantity) < 0 ? "text-red-700" : "text-emerald-700")}>
                          {Number(m.quantity) > 0 ? "+" : "−"}
                          {formatQty(Math.abs(Number(m.quantity)))}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-slate-700 sm:px-6">{formatQty(m.balance_after)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="px-6 py-4 text-sm text-slate-600">
                No movements yet. Receive stock, or count what&apos;s on the shelf to set the opening stock.
              </p>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          {p.track_stock ? (
            <>
              <Card className="p-5">
                <h2 className="mb-3 text-sm font-semibold text-slate-900">Receive stock</h2>
                <ReceiveForm partId={p.id} unit={unit} cost={p.cost_price != null ? String(Number(p.cost_price)) : ""} supplier={p.supplier ?? ""} />
              </Card>
              <Card className="p-5">
                <h2 className="mb-1 text-sm font-semibold text-slate-900">Count stock</h2>
                <p className="mb-3 text-xs text-slate-500">For opening stock, stock-takes and damage. The difference is recorded with your reason.</p>
                <CountForm partId={p.id} unit={unit} onHand={`${formatQty(onHand)} ${unit}`} />
              </Card>
            </>
          ) : null}
          <details className="rounded-lg bg-white ring-1 ring-slate-200">
            <summary className="cursor-pointer px-5 py-3 text-sm font-medium text-brand-700">Edit part details</summary>
            <div className="border-t border-slate-200 p-5">
              <PartForm
                key={p.updated_at}
                id={p.id}
                defaults={{
                  name: p.name,
                  partNumber: p.part_number ?? "",
                  brand: p.brand ?? "",
                  category: p.category ?? "",
                  supplier: p.supplier ?? "",
                  costPrice: p.cost_price?.toString() ?? "",
                  sellingPrice: String(p.selling_price),
                  unit: p.unit,
                }}
              />
            </div>
          </details>
          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Stock settings</h2>
            <StockSettingsForm
              partId={p.id}
              trackStock={p.track_stock}
              reorderLevel={p.reorder_level != null ? String(Number(p.reorder_level)) : ""}
              location={p.location ?? ""}
            />
          </Card>
        </div>
      </div>
    </>
  );
}
