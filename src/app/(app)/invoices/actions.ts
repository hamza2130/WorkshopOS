"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/session";
import { formValues, invalid, type ActionState } from "@/lib/forms";
import { invoiceError, invoiceLineSchema, paymentSchema, refundSchema, voidSchema } from "@/lib/invoices";
import { formatMoney } from "@/lib/money";
import { isUuid } from "@/lib/params";
import { createClient } from "@/lib/supabase/server";

async function refresh(invoiceId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("invoices").select("job_card_id, customer_id").eq("id", invoiceId).maybeSingle();
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
  revalidatePath("/dashboard");
  if (data) {
    revalidatePath(`/jobs/${data.job_card_id}`);
    revalidatePath(`/customers/${data.customer_id}`);
  }
}

/** From the job card or the "Ready to bill" list: makes the draft and opens it. */
export async function createInvoice(formData: FormData) {
  await requirePermission("invoices.manage");
  const jobId = formData.get("jobId");
  if (!isUuid(jobId)) redirect("/invoices");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_invoice", { p_job: jobId });
  if (error || !data) {
    // Usually a double click: the job already has its invoice.
    const { data: existing } = await supabase.from("invoices").select("id").eq("job_card_id", jobId).neq("status", "void").maybeSingle();
    redirect(existing ? `/invoices/${existing.id}` : `/invoices?error=${encodeURIComponent(error?.message ?? "failed")}`);
  }
  revalidatePath("/invoices");
  revalidatePath(`/jobs/${jobId}`);
  redirect(`/invoices/${data}`);
}

async function nextPosition(invoiceId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("invoice_items").select("position").eq("invoice_id", invoiceId).order("position", { ascending: false }).limit(1);
  return (data?.[0]?.position ?? -1) + 1;
}

export async function addInvoiceLine(_: ActionState | undefined, formData: FormData): Promise<ActionState> {
  const ctx = await requirePermission("invoices.manage");
  const invoiceId = formData.get("invoiceId");
  if (!isUuid(invoiceId)) return { error: "Invalid invoice." };
  const parsed = invoiceLineSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formData);
  const d = parsed.data;
  const source = formData.get("source") === "parts_used" ? "parts_used" : "added";

  const supabase = await createClient();
  const { error } = await supabase.from("invoice_items").insert({
    workshop_id: ctx.workshop.workshopId,
    invoice_id: invoiceId,
    position: await nextPosition(invoiceId),
    kind: d.kind,
    source,
    description: d.description,
    part_id: d.partId,
    part_number: String(formData.get("partNumber") ?? "").trim().slice(0, 60) || null,
    quantity: d.quantity,
    unit_price: d.unitPrice ?? 0,
    discount: d.discount,
    taxable: d.taxable,
  });
  if (error) return { error: invoiceError(error, "We couldn't add this line."), values: formValues(formData) };
  await refresh(invoiceId);
  return { success: `Added “${d.description}”.`, nonce: Date.now() };
}

export async function updateInvoiceLine(_: ActionState | undefined, formData: FormData): Promise<ActionState> {
  await requirePermission("invoices.manage");
  const invoiceId = formData.get("invoiceId");
  const lineId = formData.get("lineId");
  if (!isUuid(invoiceId) || !isUuid(lineId)) return { error: "Invalid line." };
  const parsed = invoiceLineSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formData);
  const d = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoice_items")
    .update({ description: d.description, quantity: d.quantity, unit_price: d.unitPrice ?? 0, discount: d.discount, taxable: d.taxable })
    .eq("id", lineId)
    .eq("invoice_id", invoiceId)
    .select("id");
  if (error || !data?.length) return { error: invoiceError(error, "We couldn't save this line."), values: formValues(formData) };
  await refresh(invoiceId);
  return { success: "Saved.", nonce: Date.now() };
}

export async function removeInvoiceLine(_: ActionState | undefined, formData: FormData): Promise<ActionState> {
  await requirePermission("invoices.manage");
  const invoiceId = formData.get("invoiceId");
  const lineId = formData.get("lineId");
  if (!isUuid(invoiceId) || !isUuid(lineId)) return { error: "Invalid line." };
  const supabase = await createClient();
  const { error } = await supabase.from("invoice_items").delete().eq("id", lineId).eq("invoice_id", invoiceId);
  if (error) return { error: invoiceError(error, "We couldn't remove this line.") };
  await refresh(invoiceId);
  return { success: "Removed." };
}

export async function saveInvoiceNotes(_: ActionState | undefined, formData: FormData): Promise<ActionState> {
  await requirePermission("invoices.manage");
  const invoiceId = formData.get("invoiceId");
  if (!isUuid(invoiceId)) return { error: "Invalid invoice." };
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 1000);
  const supabase = await createClient();
  const { error } = await supabase.from("invoices").update({ notes: notes || null }).eq("id", invoiceId);
  if (error) return { error: invoiceError(error, "We couldn't save the notes."), values: formValues(formData) };
  await refresh(invoiceId);
  return { success: "Notes saved." };
}

export async function issueInvoice(_: ActionState | undefined, formData: FormData): Promise<ActionState> {
  await requirePermission("invoices.manage");
  const invoiceId = formData.get("invoiceId");
  if (!isUuid(invoiceId)) return { error: "Invalid invoice." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("issue_invoice", { p_invoice: invoiceId });
  if (error) return { error: invoiceError(error, "We couldn't issue this invoice.") };
  await refresh(invoiceId);
  return { success: `Issued as ${data}.` };
}

export async function voidInvoice(_: ActionState | undefined, formData: FormData): Promise<ActionState> {
  await requirePermission("invoices.manage");
  const parsed = voidSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formData);
  const supabase = await createClient();
  const { error } = await supabase.rpc("void_invoice", { p_invoice: parsed.data.invoiceId, p_reason: parsed.data.reason });
  if (error) return { error: invoiceError(error, "We couldn't void this invoice."), values: formValues(formData) };
  await refresh(parsed.data.invoiceId);
  return { success: "Invoice voided. It stays on record with your reason." };
}

export async function recordPayment(_: ActionState | undefined, formData: FormData): Promise<ActionState> {
  const ctx = await requirePermission("payments.record");
  const parsed = paymentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formData);
  const d = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_payment", {
    p_invoice: d.invoiceId,
    p_amount: d.amount ?? 0,
    p_method: d.method,
    p_reference: d.reference ?? undefined,
    p_note: d.note ?? undefined,
  });
  if (error) {
    if (error.message === "overpayment") {
      const { data: inv } = await supabase.from("invoices").select("balance_due").eq("id", d.invoiceId).maybeSingle();
      const due = formatMoney(inv?.balance_due ?? 0, ctx.workshop.currency);
      return { error: `Only ${due} is still due on this invoice.`, fieldErrors: { amount: [`At most ${due}.`] }, values: formValues(formData) };
    }
    return { error: invoiceError(error, "We couldn't record this payment."), values: formValues(formData) };
  }
  await refresh(d.invoiceId);
  return { success: "Payment recorded.", nonce: Date.now() };
}

export async function refundPayment(_: ActionState | undefined, formData: FormData): Promise<ActionState> {
  const ctx = await requirePermission("invoices.manage");
  const parsed = refundSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formData);
  const d = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("refund_payment", {
    p_payment: d.paymentId,
    p_amount: d.amount ?? 0,
    p_method: d.method,
    p_reason: d.reason,
  });
  if (error) {
    if (error.message === "refund_too_large") {
      const { data: rows } = await supabase.from("payments").select("id, amount, refund_of").or(`id.eq.${d.paymentId},refund_of.eq.${d.paymentId}`);
      const paid = Number(rows?.find((r) => r.id === d.paymentId)?.amount ?? 0);
      const back = (rows ?? []).filter((r) => r.refund_of === d.paymentId).reduce((s, r) => s + Number(r.amount), 0);
      return { error: `At most ${formatMoney(paid - back, ctx.workshop.currency)} of this payment can still be refunded.`, values: formValues(formData) };
    }
    return { error: invoiceError(error, "We couldn't record this refund."), values: formValues(formData) };
  }
  await refresh(d.invoiceId);
  return { success: "Refund recorded.", nonce: Date.now() };
}
