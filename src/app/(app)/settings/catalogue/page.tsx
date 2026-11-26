import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, PageHeader } from "@/components/ui";
import { requirePageAccess } from "@/lib/auth/session";
import { formatQty } from "@/lib/inventory";
import { formatMoney } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { SettingsTabs } from "../settings-tabs";
import { ActiveToggle, LabourForm, PartForm } from "./catalogue-forms";

export const metadata: Metadata = { title: "Labour and parts" };

export default async function CataloguePage() {
  const ctx = await requirePageAccess("workshop.settings");
  const supabase = await createClient();
  const cur = ctx.workshop.currency;
  const [labour, parts] = await Promise.all([
    supabase.from("labour_items").select("*").eq("workshop_id", ctx.workshop.workshopId).order("is_active", { ascending: false }).order("name"),
    supabase.from("parts").select("*").eq("workshop_id", ctx.workshop.workshopId).order("is_active", { ascending: false }).order("name"),
  ]);

  return (
    <>
      <PageHeader title="Settings" description="Saved services and parts make estimates quick and consistent." />
      <SettingsTabs />

      <Card className="p-6">
        <h2 className="text-base font-semibold text-slate-900">Labour services</h2>
        <p className="mb-4 mt-1 text-sm text-slate-600">Common jobs with your standard price. Staff can still change the price on an estimate.</p>
        <LabourForm />
        {labour.data?.length ? (
          <ul className="mt-6 divide-y divide-slate-100 border-t border-slate-200">
            {labour.data.map((l) => (
              <li key={l.id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm">
                    <span className="font-medium text-slate-900">{l.name}</span>
                    <span className="ml-2 text-slate-600">
                      {formatMoney(l.default_price, cur)}
                      {l.estimated_minutes ? ` · ${l.estimated_minutes} min` : ""}
                    </span>
                    {!l.is_active ? (
                      <span className="ml-2">
                        <Badge tone="muted">Hidden</Badge>
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1">
                    <details className="group">
                      <summary className="cursor-pointer list-none rounded-md px-2 py-1 text-xs text-brand-700 hover:bg-brand-50">Edit</summary>
                      <div className="mt-3 w-full min-w-72 rounded-md bg-slate-50 p-4 ring-1 ring-slate-200 sm:min-w-[32rem]">
                        <LabourForm
                          key={`${l.updated_at}`}
                          id={l.id}
                          defaults={{
                            name: l.name,
                            defaultPrice: String(l.default_price),
                            estimatedMinutes: l.estimated_minutes?.toString() ?? "",
                            description: l.description ?? "",
                          }}
                        />
                      </div>
                    </details>
                    <ActiveToggle id={l.id} table="labour_items" active={l.is_active} />
                  </div>
                </div>
                {l.description ? <p className="mt-0.5 text-xs text-slate-500">{l.description}</p> : null}
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      <Card className="mt-6 p-6">
        <h2 className="text-base font-semibold text-slate-900">Parts</h2>
        <p className="mb-4 mt-1 text-sm text-slate-600">
          Parts you sell often. Cost prices stay with staff — customers only ever see selling prices. Stock is kept in{" "}
          <Link href="/inventory" className="text-brand-700 hover:underline">
            Inventory
          </Link>
          .
        </p>
        <PartForm />
        {parts.data?.length ? (
          <ul className="mt-6 divide-y divide-slate-100 border-t border-slate-200">
            {parts.data.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div className="text-sm">
                  <span className="font-medium text-slate-900">{p.name}</span>
                  <span className="ml-2 text-slate-600">
                    {[p.brand, p.part_number].filter(Boolean).join(" · ")}
                    {p.brand || p.part_number ? " · " : ""}
                    {formatMoney(p.selling_price, cur)} / {p.unit}
                    {p.cost_price != null ? ` (cost ${formatMoney(p.cost_price, cur)})` : ""}
                  </span>
                  {p.track_stock ? (
                    <Link href={`/inventory/${p.id}`} className="ml-2 text-xs text-brand-700 hover:underline">
                      {formatQty(p.stock_on_hand)} {p.unit} in stock
                    </Link>
                  ) : null}
                  {!p.is_active ? (
                    <span className="ml-2">
                      <Badge tone="muted">Hidden</Badge>
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-1">
                  <details>
                    <summary className="cursor-pointer list-none rounded-md px-2 py-1 text-xs text-brand-700 hover:bg-brand-50">Edit</summary>
                    <div className="mt-3 min-w-72 rounded-md bg-slate-50 p-4 ring-1 ring-slate-200 sm:min-w-[36rem]">
                      <PartForm
                        key={`${p.updated_at}`}
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
                  <ActiveToggle id={p.id} table="parts" active={p.is_active} />
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>
    </>
  );
}
