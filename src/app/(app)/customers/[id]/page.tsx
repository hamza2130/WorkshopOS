import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArchiveButton } from "@/components/archive-button";
import { Alert, Badge, buttonClass, Card, PageHeader } from "@/components/ui";
import { requirePageAccess } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { isUuid, withParams } from "@/lib/params";
import { whatsappLink } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";
import { setCustomerArchived } from "../actions";

export const metadata: Metadata = { title: "Customer" };

export default async function CustomerPage({ params }: PageProps<"/customers/[id]">) {
  const ctx = await requirePageAccess("customers.manage");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const tz = ctx.workshop.timezone;

  const supabase = await createClient();
  const [{ data: c }, { data: vehicles }] = await Promise.all([
    supabase.from("customers").select("*").eq("id", id).eq("workshop_id", ctx.workshop.workshopId).maybeSingle(),
    supabase
      .from("vehicles")
      .select("id, registration_number, make, model, variant, year, colour, archived_at")
      .eq("customer_id", id)
      .order("archived_at", { nullsFirst: true })
      .order("created_at"),
  ]);
  if (!c) notFound();

  const vehicleIds = (vehicles ?? []).map((v) => v.id);
  const { data: readings } = vehicleIds.length
    ? await supabase
        .from("vehicle_mileage_readings")
        .select("vehicle_id, reading, recorded_at")
        .in("vehicle_id", vehicleIds)
        .order("recorded_at", { ascending: false })
    : { data: [] };
  const latest = new Map<string, number>();
  for (const r of readings ?? []) if (!latest.has(r.vehicle_id)) latest.set(r.vehicle_id, r.reading);

  const wa = c.whatsapp ? whatsappLink(c.whatsapp, `Assalam-o-Alaikum ${c.name}, this is ${ctx.workshop.workshopName}.`) : null;
  const isOwner = ctx.workshop.role === "owner";

  return (
    <>
      <PageHeader
        title={c.name}
        description={`${c.code} · customer since ${formatDate(c.created_at, tz)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/customers/${c.id}/edit`} className={buttonClass("secondary")}>
              Edit
            </Link>
            {!c.archived_at ? (
              <Link href={withParams("/vehicles/new", { customerId: c.id })} className={buttonClass("primary")}>
                Add vehicle
              </Link>
            ) : null}
            {isOwner ? (
              <ArchiveButton action={setCustomerArchived} idField="customerId" id={c.id} archived={Boolean(c.archived_at)} noun="customer" />
            ) : null}
          </div>
        }
      />

      {c.archived_at ? (
        <div className="mb-6">
          <Alert tone="info">This customer was archived on {formatDate(c.archived_at, tz)}. Their history is kept.</Alert>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-1">
          <h2 className="text-sm font-semibold text-slate-900">Contact</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-slate-500">Phone</dt>
              <dd className="flex flex-wrap items-center gap-2 text-slate-900">
                <a href={`tel:${c.phone.replace(/[^\d+]/g, "")}`} className="hover:underline">
                  {c.phone}
                </a>
                {c.shared_phone_confirmed ? <Badge tone="warning">Shared number</Badge> : null}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">WhatsApp</dt>
              <dd className="text-slate-900">
                {wa ? (
                  <a href={wa} target="_blank" rel="noopener noreferrer" className="text-brand-700 hover:underline">
                    {c.whatsapp} — open chat
                  </a>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Email</dt>
              <dd className="text-slate-900">{c.email ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Address</dt>
              <dd className="text-slate-900">{c.address ?? "—"}</dd>
            </div>
            {c.notes ? (
              <div>
                <dt className="text-slate-500">Notes</dt>
                <dd className="whitespace-pre-line text-slate-900">{c.notes}</dd>
              </div>
            ) : null}
          </dl>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card className="overflow-hidden">
            <h2 className="border-b border-slate-200 px-6 py-3 text-sm font-semibold text-slate-900">
              Vehicles ({vehicles?.filter((v) => !v.archived_at).length ?? 0})
            </h2>
            {vehicles?.length ? (
              <ul className="divide-y divide-slate-100">
                {vehicles.map((v) => (
                  <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 px-6 py-3">
                    <div>
                      <Link href={`/vehicles/${v.id}`} className="font-medium text-slate-900 hover:text-brand-700 hover:underline">
                        {v.registration_number}
                      </Link>
                      <span className="ml-2 text-sm text-slate-600">
                        {[v.make, v.model, v.variant, v.year].filter(Boolean).join(" ")}
                        {v.colour ? ` · ${v.colour}` : ""}
                      </span>
                      {v.archived_at ? (
                        <span className="ml-2">
                          <Badge tone="muted">Archived</Badge>
                        </span>
                      ) : null}
                    </div>
                    <span className="text-sm tabular-nums text-slate-600">
                      {latest.has(v.id) ? `${latest.get(v.id)!.toLocaleString("en-PK")} km` : "No mileage yet"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-6 py-6 text-sm text-slate-600">No vehicles yet.</p>
            )}
          </Card>

          <Card className="p-6">
            <h2 className="text-sm font-semibold text-slate-900">Repair history, estimates and invoices</h2>
            <p className="mt-1 text-sm text-slate-600">
              Job cards, estimates, invoices, payments and balances for this customer will appear here as those modules ship.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
