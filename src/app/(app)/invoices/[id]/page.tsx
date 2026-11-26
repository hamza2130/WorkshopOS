import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, Badge, buttonClass, Card, cx, PageHeader } from "@/components/ui";
import { requirePageAccess } from "@/lib/auth/session";
import { invoiceTotals, loadInvoice } from "@/lib/billing";
import { KIND_LABELS } from "@/lib/estimates";
import { formatDateTime } from "@/lib/format";
import { invoiceMessage, LINE_SOURCE_LABELS, PAYMENT_METHOD_LABELS, PAYMENT_STATE_LABELS, PAYMENT_STATE_TONES } from "@/lib/invoices";
import { formatMoney } from "@/lib/money";
import { isUuid } from "@/lib/params";
import { whatsappLink } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";
import {
  AddLineForm,
  AddPartUsedLine,
  IssueForm,
  LineEditor,
  NotesForm,
  PaymentForm,
  RefundForm,
  VoidForm,
  type CataloguePart,
} from "./invoice-forms";

export const metadata: Metadata = { title: "Invoice" };

export default async function InvoicePage({ params }: PageProps<"/invoices/[id]">) {
  const ctx = await requirePageAccess("invoices.manage", "payments.record", "jobs.manage");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const loaded = await loadInvoice(id, ctx.workshop.workshopId);
  if (!loaded) notFound();

  const { invoice: inv, items, ledger, job, state } = loaded;
  const cur = ctx.workshop.currency;
  const tz = ctx.workshop.timezone;
  const money = (n: number | string) => formatMoney(n, cur);
  const canManage = ctx.permissions.has("invoices.manage");
  const canPay = ctx.permissions.has("payments.record");
  const draft = inv.status === "draft";
  const editable = draft && canManage;
  const balance = Number(inv.balance_due);

  const supabase = await createClient();
  // Parts the mechanics recorded that aren't billed yet: offered as one-tap lines on a draft.
  const [partsUsed, catalogue] = editable
    ? await Promise.all([
        supabase
          .from("job_parts_used")
          .select("id, description, quantity, part_id, estimate_item_id, part:parts(part_number, selling_price)")
          .eq("job_card_id", job.id)
          .is("removed_at", null)
          .is("estimate_item_id", null),
        supabase.from("parts").select("id, name, part_number, brand, selling_price, unit").eq("workshop_id", ctx.workshop.workshopId).eq("is_active", true).order("name"),
      ])
    : [{ data: [] }, { data: [] }];
  const billedParts = new Set(items.map((i) => i.part_id).filter(Boolean));
  const billedNames = new Set(items.map((i) => i.description.trim().toLowerCase()));
  const unbilled = (partsUsed.data ?? []).filter(
    (p) => !(p.part_id && billedParts.has(p.part_id)) && !billedNames.has(p.description.trim().toLowerCase()),
  );
  const parts: CataloguePart[] = (catalogue.data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    partNumber: p.part_number,
    price: Number(p.selling_price),
    label: `${p.name} — ${money(p.selling_price)}${p.brand ? ` (${p.brand})` : ""}`,
  }));

  const vehicleLabel = [loaded.registration, loaded.vehicleDescription].filter(Boolean).join(" · ");
  const wa =
    inv.status === "issued" && loaded.whatsapp
      ? whatsappLink(
          loaded.whatsapp,
          invoiceMessage({
            customerName: loaded.customerName,
            workshopName: ctx.workshop.workshopName,
            invoiceNumber: inv.invoice_number!,
            vehicle: loaded.registration,
            total: money(inv.total),
            balance: money(balance),
            paid: balance <= 0,
          }),
        )
      : null;
  const refunds = new Map<string, number>();
  for (const r of ledger) if (r.kind === "refund" && r.refundOf) refunds.set(r.refundOf, (refunds.get(r.refundOf) ?? 0) + r.amount);

  return (
    <>
      <PageHeader
        title={inv.invoice_number ?? "Draft invoice"}
        description={`${job.job_number} · ${loaded.customerName} · ${vehicleLabel}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={PAYMENT_STATE_TONES[state]}>{PAYMENT_STATE_LABELS[state]}</Badge>
            <a href={`/invoices/${inv.id}/pdf`} target="_blank" rel="noopener" className={buttonClass("secondary")}>
              {draft ? "Preview PDF" : "Download PDF"}
            </a>
            {wa ? (
              <a href={wa} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary")}>
                Send on WhatsApp
              </a>
            ) : null}
          </div>
        }
      />

      {inv.status === "void" ? (
        <div className="mb-6">
          <Alert tone="error">
            Voided {inv.voided_at ? formatDateTime(inv.voided_at, tz) : ""}
            {loaded.voidedBy ? ` by ${loaded.voidedBy}` : ""}: {inv.void_reason}. It stays on record and can&apos;t be changed.
          </Alert>
        </div>
      ) : draft ? (
        <div className="mb-6">
          <Alert tone="info">
            Draft — check the lines, then issue it. Lines from the customer&apos;s approved estimate are filled in already.
          </Alert>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-6">
          <Card className="overflow-hidden">
            {items.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th scope="col" className="px-4 py-2 font-medium sm:min-w-52 sm:px-6">Line</th>
                      {/* On phones quantity, price and discount fold under the description. */}
                      <th scope="col" className="hidden px-3 py-2 text-right font-medium sm:table-cell">Qty</th>
                      <th scope="col" className="hidden px-3 py-2 text-right font-medium sm:table-cell">Price</th>
                      <th scope="col" className="hidden px-3 py-2 text-right font-medium sm:table-cell">Discount</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">Amount</th>
                      {editable ? (
                        <th scope="col" className="px-6 py-2">
                          <span className="sr-only">Actions</span>
                        </th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((l) => (
                      <tr key={l.id}>
                        <td className="px-4 py-3 sm:px-6">
                          <span className="font-medium text-slate-900">{l.description}</span>
                          <span className="block text-xs text-slate-500">
                            {KIND_LABELS[l.kind]}
                            {l.part_number ? ` · ${l.part_number}` : ""}
                            {!l.taxable ? " · not taxed" : ""}
                          </span>
                          <span className="block text-xs tabular-nums text-slate-600 sm:hidden">
                            {l.quantity} × {money(l.unit_price)}
                            {l.discount ? ` · −${money(l.discount)}` : ""}
                          </span>
                          {l.source !== "approved_estimate" ? (
                            <span className="mt-1 inline-block">
                              <Badge tone="warning">{LINE_SOURCE_LABELS[l.source]}</Badge>
                            </span>
                          ) : null}
                        </td>
                        <td className="hidden px-3 py-3 text-right tabular-nums sm:table-cell">{l.quantity}</td>
                        <td className="hidden px-3 py-3 text-right tabular-nums sm:table-cell">{money(l.unit_price)}</td>
                        <td className="hidden px-3 py-3 text-right tabular-nums sm:table-cell">{l.discount ? `−${money(l.discount)}` : "—"}</td>
                        <td className="px-3 py-3 text-right align-top font-medium tabular-nums">{money(l.line_total)}</td>
                        {editable ? (
                          <td className="px-4 py-3 text-right sm:px-6">
                            <LineEditor
                              invoiceId={inv.id}
                              line={{ id: l.id, description: l.description, quantity: l.quantity, unitPrice: l.unit_price, discount: l.discount, taxable: l.taxable }}
                            />
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="px-6 py-6 text-sm text-slate-600">
                No lines yet{inv.estimate_id ? "" : " — this job has no approved estimate, so add the work below"}.
              </p>
            )}
            <dl className="space-y-1 border-t border-slate-200 px-6 py-4 text-sm">
              {invoiceTotals(inv, cur).map((t) => (
                <div key={t.label} className={cx("flex justify-between", t.strong ? "text-base font-semibold text-slate-900" : "text-slate-600")}>
                  <dt>{t.label}</dt>
                  <dd className="tabular-nums">{t.value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          {editable && unbilled.length ? (
            <Card className="p-6">
              <h2 className="text-sm font-semibold text-slate-900">Parts used but not on the approved estimate</h2>
              <p className="mt-1 text-xs text-slate-500">The mechanics recorded these. Bill them only if the customer agreed to the extra parts.</p>
              <ul className="mt-3 divide-y divide-slate-100">
                {unbilled.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <span className="text-sm text-slate-800">
                      {Number(p.quantity)} × {p.description}
                    </span>
                    <AddPartUsedLine
                      invoiceId={inv.id}
                      description={p.description}
                      quantity={Number(p.quantity)}
                      partId={p.part_id}
                      partNumber={p.part?.part_number ?? null}
                      price={p.part ? Number(p.part.selling_price) : null}
                    />
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {editable ? (
            <Card className="p-6">
              <h2 className="mb-3 text-sm font-semibold text-slate-900">Add a line</h2>
              <AddLineForm invoiceId={inv.id} parts={parts} />
            </Card>
          ) : null}

          {inv.status !== "draft" ? (
            <Card className="overflow-hidden">
              <h2 className="border-b border-slate-200 px-6 py-3 text-sm font-semibold text-slate-900">Payments</h2>
              {ledger.length ? (
                <ul className="divide-y divide-slate-100">
                  {ledger.map((p) => (
                    <li key={p.id} className="px-6 py-3 text-sm">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-slate-900">
                          {p.kind === "refund" ? "Refund" : "Payment"} · {PAYMENT_METHOD_LABELS[p.method]}
                          {p.reference ? ` · ${p.reference}` : ""}
                        </span>
                        <span className={cx("font-medium tabular-nums", p.kind === "refund" ? "text-red-700" : "text-slate-900")}>
                          {p.kind === "refund" ? "−" : ""}
                          {money(p.amount)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {formatDateTime(p.receivedAt, tz)} · {p.recordedBy}
                        {p.note ? ` · ${p.note}` : ""}
                        {p.kind === "payment" && refunds.get(p.id) ? ` · ${money(refunds.get(p.id)!)} refunded` : ""}
                      </p>
                      {p.kind === "payment" && p.refundable > 0 && canManage && inv.status === "issued" ? (
                        <RefundForm invoiceId={inv.id} paymentId={p.id} max={p.refundable} />
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-6 py-4 text-sm text-slate-600">No payments yet.</p>
              )}
              {inv.status === "issued" && balance > 0 && canPay ? (
                <div className="border-t border-slate-200 px-6 py-4">
                  <h3 className="mb-3 text-sm font-semibold text-slate-900">Record a payment · {money(balance)} due</h3>
                  <PaymentForm invoiceId={inv.id} balance={balance} />
                </div>
              ) : null}
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          {draft && canManage ? (
            <Card className="space-y-5 p-5">
              <IssueForm invoiceId={inv.id} total={money(inv.total)} />
              <NotesForm invoiceId={inv.id} notes={inv.notes ?? ""} />
            </Card>
          ) : null}

          <Card className="p-5 text-sm">
            <h2 className="font-semibold text-slate-900">Bill to</h2>
            <Link href={`/customers/${loaded.customerId}`} className="mt-1 block font-medium text-brand-700 hover:underline">
              {loaded.customerName}
            </Link>
            {loaded.customerPhone ? <p className="text-slate-600">{loaded.customerPhone}</p> : null}
            <h2 className="mt-4 font-semibold text-slate-900">Vehicle</h2>
            <p className="mt-1 text-slate-800">{vehicleLabel}</p>
            {loaded.odometer != null ? <p className="text-slate-600">{loaded.odometer.toLocaleString("en-PK")} km</p> : null}
            <h2 className="mt-4 font-semibold text-slate-900">Job card</h2>
            {ctx.permissions.has("jobs.manage") ? (
              <Link href={`/jobs/${job.id}`} className="mt-1 block text-brand-700 hover:underline">
                {job.job_number}
              </Link>
            ) : (
              <p className="mt-1 text-slate-800">{job.job_number}</p>
            )}
            {inv.issued_at ? (
              <>
                <h2 className="mt-4 font-semibold text-slate-900">Issued</h2>
                <p className="mt-1 text-slate-600">
                  {formatDateTime(inv.issued_at, tz)}
                  {loaded.issuedBy ? ` · ${loaded.issuedBy}` : ""}
                </p>
              </>
            ) : null}
            {!draft && inv.notes ? (
              <>
                <h2 className="mt-4 font-semibold text-slate-900">Notes</h2>
                <p className="mt-1 whitespace-pre-line text-slate-700">{inv.notes}</p>
              </>
            ) : null}
          </Card>

          {canManage && inv.status !== "void" ? (
            <Card className="p-5">
              <h2 className="mb-2 text-sm font-semibold text-slate-900">Void</h2>
              <VoidForm
                invoiceId={inv.id}
                blocked={
                  Number(inv.amount_paid) > 0
                    ? `${money(inv.amount_paid)} has been received. Refund the payments before voiding — voids are for invoices that should never have been billed.`
                    : null
                }
              />
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
