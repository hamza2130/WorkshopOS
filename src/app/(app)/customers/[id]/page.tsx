import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArchiveButton } from "@/components/archive-button";
import { JobHistoryList } from "@/components/job-history-list";
import { Alert, Badge, buttonClass, Card, PageHeader } from "@/components/ui";
import { requirePageAccess } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { paymentState, PAYMENT_STATE_LABELS, PAYMENT_STATE_TONES } from "@/lib/invoices";
import { formatMoney } from "@/lib/money";
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
  const [{ data: c }, { data: vehicles }, { data: jobs }, { data: invoices }] = await Promise.all([
    supabase.from("customers").select("*").eq("id", id).eq("workshop_id", ctx.workshop.workshopId).maybeSingle(),
    supabase
      .from("vehicles")
      .select("id, registration_number, make, model, variant, year, colour, archived_at")
      .eq("customer_id", id)
      .order("archived_at", { nullsFirst: true })
      .order("created_at"),
    supabase
      .from("job_cards")
      .select("id, job_number, status, check_in_at, check_in_mileage, complaint, vehicles(registration_number)")
      .eq("customer_id", id)
      .order("check_in_at", { ascending: false })
      .limit(50),
    supabase
      .from("invoices")
      .select("id, invoice_number, status, total, amount_paid, balance_due, issued_at, created_at, job:job_cards(job_number)")
      .eq("customer_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
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
  const canOpenJobs = ctx.permissions.has("jobs.manage");
  const owed = (invoices ?? []).filter((i) => i.status === "issued").reduce((sum, i) => sum + Number(i.balance_due), 0);

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
                    <div className="flex items-center gap-3">
                      <span className="text-sm tabular-nums text-slate-600">
                        {latest.has(v.id) ? `${latest.get(v.id)!.toLocaleString("en-PK")} km` : "No mileage yet"}
                      </span>
                      {/* Returning customers usually come in for a new job on a car we already know. */}
                      {canOpenJobs && !v.archived_at && !c.archived_at ? (
                        <Link href={withParams("/jobs/new", { vehicleId: v.id })} className={buttonClass("secondary", "py-1.5")}>
                          New job card
                        </Link>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-6 py-6 text-sm text-slate-600">No vehicles yet.</p>
            )}
          </Card>

          <Card className="overflow-hidden">
            <h2 className="border-b border-slate-200 px-6 py-3 text-sm font-semibold text-slate-900">
              Repair history ({jobs?.length ?? 0})
            </h2>
            <JobHistoryList
              jobs={(jobs ?? []).map((j) => ({ ...j, label: j.vehicles?.registration_number }))}
              timeZone={tz}
              empty="No job cards yet."
            />
          </Card>

          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 px-6 py-3">
              <h2 className="text-sm font-semibold text-slate-900">Invoices ({invoices?.length ?? 0})</h2>
              <span className={`text-sm ${owed > 0 ? "font-medium text-amber-800" : "text-slate-600"}`}>
                {owed > 0 ? `${formatMoney(owed, ctx.workshop.currency)} owed` : "Nothing owed"}
              </span>
            </div>
            {invoices?.length ? (
              <ul className="divide-y divide-slate-100">
                {invoices.map((i) => {
                  const st = paymentState(i.status, Number(i.total), Number(i.amount_paid));
                  return (
                    <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 px-6 py-3 text-sm">
                      <div>
                        <Link href={`/invoices/${i.id}`} className="font-medium text-slate-900 hover:text-brand-700 hover:underline">
                          {i.invoice_number ?? "Draft"}
                        </Link>
                        <span className="ml-2 text-slate-600">
                          {i.job?.job_number} · {formatDate(i.issued_at ?? i.created_at, tz)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="tabular-nums text-slate-800">{formatMoney(i.total, ctx.workshop.currency)}</span>
                        <Badge tone={PAYMENT_STATE_TONES[st]}>{PAYMENT_STATE_LABELS[st]}</Badge>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="px-6 py-4 text-sm text-slate-600">No invoices yet.</p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
