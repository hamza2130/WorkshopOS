import "server-only";
import { formatDate, formatDateTime } from "./format";
import { KIND_LABELS } from "./estimates";
import type { InvoicePdfData } from "./invoice-pdf";
import { PAYMENT_METHOD_LABELS, paymentState, type InvoiceLineSource, type PaymentKind, type PaymentMethod } from "./invoices";
import { formatMoney } from "./money";
import { createClient } from "./supabase/server";

const personName = (p: { full_name: string; email: string } | null | undefined) => p?.full_name || p?.email || "Someone";

export type LedgerRow = {
  id: string;
  kind: PaymentKind;
  amount: number;
  method: PaymentMethod;
  reference: string | null;
  note: string | null;
  refundOf: string | null;
  receivedAt: string;
  recordedBy: string;
  /** Payments only: what can still be refunded. */
  refundable: number;
};

/** One invoice with its lines and ledger, as the signed-in user may see it. */
export async function loadInvoice(id: string, workshopId: string) {
  const supabase = await createClient();
  const { data: inv } = await supabase
    .from("invoices")
    .select(
      "*, job:job_cards(id, job_number, status, check_in_mileage), customer:customers(id, name, phone, whatsapp), vehicle:vehicles(id, registration_number, make, model, variant, year), voider:profiles!invoices_voided_by_fkey(full_name, email), issuer:profiles!invoices_issued_by_fkey(full_name, email)",
    )
    .eq("id", id)
    .eq("workshop_id", workshopId)
    .maybeSingle();
  if (!inv || !inv.job || !inv.customer || !inv.vehicle) return null;

  const [items, payments] = await Promise.all([
    supabase
      .from("invoice_items")
      .select("id, position, kind, source, description, part_id, part_number, quantity, unit_price, discount, taxable, line_total")
      .eq("invoice_id", id)
      .order("position")
      .order("created_at"),
    supabase
      .from("payments")
      .select("id, kind, amount, method, reference, note, refund_of, received_at, recorder:profiles!payments_recorded_by_fkey(full_name, email)")
      .eq("invoice_id", id)
      .order("received_at"),
  ]);

  const refunded = new Map<string, number>();
  for (const p of payments.data ?? []) {
    if (p.kind === "refund" && p.refund_of) refunded.set(p.refund_of, (refunded.get(p.refund_of) ?? 0) + Number(p.amount));
  }
  const ledger: LedgerRow[] = (payments.data ?? []).map((p) => ({
    id: p.id,
    kind: p.kind,
    amount: Number(p.amount),
    method: p.method,
    reference: p.reference,
    note: p.note,
    refundOf: p.refund_of,
    receivedAt: p.received_at,
    recordedBy: personName(p.recorder),
    refundable: p.kind === "payment" ? Number(p.amount) - (refunded.get(p.id) ?? 0) : 0,
  }));

  const v = inv.vehicle;
  // Drafts show the live customer and vehicle; issued invoices show what was printed.
  const issued = inv.status !== "draft" && inv.issued_at;
  return {
    invoice: inv,
    job: inv.job,
    customerId: inv.customer.id,
    vehicleId: v.id,
    customerName: issued ? (inv.customer_name ?? inv.customer.name) : inv.customer.name,
    customerPhone: issued ? inv.customer_phone : inv.customer.phone,
    whatsapp: inv.customer.whatsapp ?? inv.customer.phone,
    registration: issued ? (inv.vehicle_registration ?? v.registration_number) : v.registration_number,
    vehicleDescription: issued
      ? inv.vehicle_description
      : [v.make, v.model, v.variant, v.year].filter(Boolean).join(" ") || null,
    odometer: issued ? inv.odometer : inv.job.check_in_mileage,
    items: (items.data ?? []).map((i) => ({
      ...i,
      quantity: Number(i.quantity),
      unit_price: Number(i.unit_price),
      discount: Number(i.discount),
      line_total: Number(i.line_total),
      source: i.source as InvoiceLineSource,
    })),
    ledger,
    state: paymentState(inv.status, Number(inv.total), Number(inv.amount_paid)),
    voidedBy: inv.voider ? personName(inv.voider) : null,
    issuedBy: inv.issuer ? personName(inv.issuer) : null,
  };
}

export type LoadedInvoice = NonNullable<Awaited<ReturnType<typeof loadInvoice>>>;

export function invoiceTotals(inv: LoadedInvoice["invoice"], currency: string) {
  const money = (n: number | string) => formatMoney(n, currency);
  const rows: { label: string; value: string; strong?: boolean }[] = [{ label: "Subtotal", value: money(inv.subtotal) }];
  if (Number(inv.discount_total)) rows.push({ label: "Discounts", value: `-${money(inv.discount_total)}` });
  rows.push({ label: `${inv.tax_label} (${Number(inv.tax_rate)}%)`, value: money(inv.tax_total) });
  rows.push({ label: "Total", value: money(inv.total), strong: true });
  if (inv.status === "issued") {
    rows.push({ label: "Paid", value: money(inv.amount_paid) });
    rows.push({ label: "Balance due", value: money(inv.balance_due ?? 0), strong: true });
  }
  return rows;
}

export async function invoicePdfData(loaded: LoadedInvoice, workshopId: string, timeZone: string, currency: string): Promise<InvoicePdfData> {
  const supabase = await createClient();
  const { data: w } = await supabase.from("workshops").select("name, address, city, phone, email").eq("id", workshopId).single();
  const money = (n: number | string) => formatMoney(n, currency);
  const inv = loaded.invoice;
  return {
    workshop: { name: w?.name ?? "Workshop", address: w?.address ?? null, city: w?.city ?? null, phone: w?.phone ?? null, email: w?.email ?? null },
    invoiceNumber: inv.invoice_number,
    status: inv.status,
    issuedAt: inv.issued_at ? formatDate(inv.issued_at, timeZone) : null,
    jobNumber: loaded.job.job_number,
    customer: { name: loaded.customerName, phone: loaded.customerPhone },
    vehicle: { registration: loaded.registration, description: loaded.vehicleDescription, odometer: loaded.odometer },
    lines: loaded.items.map((i) => ({
      description: i.description,
      kind: `${KIND_LABELS[i.kind]}${i.part_number ? ` · ${i.part_number}` : ""}${i.taxable ? "" : " · not taxed"}`,
      quantity: i.quantity,
      unitPrice: money(i.unit_price),
      discount: i.discount ? `-${money(i.discount)}` : null,
      amount: money(i.line_total),
    })),
    totals: invoiceTotals(inv, currency),
    payments: loaded.ledger.map((p) => ({
      date: formatDateTime(p.receivedAt, timeZone),
      label: p.kind === "refund" ? `Refund (${PAYMENT_METHOD_LABELS[p.method]})` : `${PAYMENT_METHOD_LABELS[p.method]}${p.reference ? ` · ${p.reference}` : ""}`,
      amount: p.kind === "refund" ? `-${money(p.amount)}` : money(p.amount),
    })),
    notes: inv.notes,
    voidReason: inv.status === "void" ? inv.void_reason : null,
  };
}
