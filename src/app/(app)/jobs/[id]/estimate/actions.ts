"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/session";
import { CATEGORY_LABELS, INSPECTION_CATEGORIES, lineSchema, OUTCOME_LABELS, type InspectionCategory } from "@/lib/estimates";
import { formValues, invalid, type ActionState } from "@/lib/forms";
import { isUuid } from "@/lib/params";
import { siteUrl } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export type LinkState = ActionState & { link?: string };

const ERRORS: Record<string, string> = {
  reason_required: "Say why the estimate is being revised — the customer will approve the new version.",
  draft_exists: "This job already has a draft estimate.",
  estimate_locked: "This version has been sent and is frozen. Revise the estimate to change it.",
  estimate_empty: "Add at least one line before sending.",
  estimate_not_draft: "This version has already been sent.",
  already_decided: "The customer has already decided on this version.",
  estimate_not_open: "Only estimates waiting for the customer have a link.",
};

function message(error: { message: string; details?: string | null } | null, fallback: string) {
  if (!error) return fallback;
  if (error.message === "estimate_not_allowed") return error.details ?? fallback;
  return ERRORS[error.message] ?? fallback;
}

function paths(jobId: string) {
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath(`/jobs/${jobId}/estimate`);
  revalidatePath("/estimates");
}

export async function createEstimate(_: ActionState | undefined, formData: FormData): Promise<ActionState> {
  await requirePermission("estimates.manage");
  const jobId = formData.get("jobId");
  if (!isUuid(jobId)) return { error: "Invalid job card." };
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 500);

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_estimate", { p_job: jobId, p_reason: reason || undefined });
  if (error) {
    return {
      error: message(error, "We couldn't start the estimate."),
      fieldErrors: error.message === "reason_required" ? { reason: ["Required."] } : undefined,
    };
  }
  paths(jobId);
  redirect(`/jobs/${jobId}/estimate`);
}

// One click from the job card: starts the first draft and opens it. If it can't
// be started, the estimate page shows the reason and the button again.
export async function startEstimate(formData: FormData) {
  const jobId = formData.get("jobId");
  const result = await createEstimate(undefined, formData);
  if (result?.error) redirect(isUuid(jobId) ? `/jobs/${jobId}/estimate` : "/jobs");
}

async function nextPosition(supabase: Awaited<ReturnType<typeof createClient>>, estimateId: string) {
  const { data } = await supabase
    .from("estimate_items")
    .select("position")
    .eq("estimate_id", estimateId)
    .order("position", { ascending: false })
    .limit(1);
  return (data?.[0]?.position ?? -1) + 1;
}

export async function addLine(_: ActionState | undefined, formData: FormData): Promise<ActionState> {
  const ctx = await requirePermission("estimates.manage");
  const estimateId = formData.get("estimateId");
  const jobId = formData.get("jobId");
  if (!isUuid(estimateId) || !isUuid(jobId)) return { error: "Invalid estimate." };
  const parsed = lineSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formData);
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("estimate_items").insert({
    workshop_id: ctx.workshop.workshopId,
    estimate_id: estimateId,
    position: await nextPosition(supabase, estimateId),
    kind: d.kind,
    source: d.source,
    inspection_category: d.inspectionCategory,
    description: d.description,
    labour_item_id: d.kind === "labour" ? d.labourItemId : null,
    part_id: d.kind === "part" ? d.partId : null,
    quantity: d.quantity,
    unit_price: d.unitPrice!,
    discount: d.discount,
    taxable: d.taxable,
  });
  if (error) return { error: message(error, "We couldn't add this line."), values: formValues(formData) };
  paths(jobId);
  return { success: `Added “${d.description}”.`, nonce: Date.now() };
}

const editSchema = z.object({ lineId: z.uuid(), jobId: z.uuid() });

export async function updateLine(_: ActionState | undefined, formData: FormData): Promise<ActionState> {
  await requirePermission("estimates.manage");
  const ids = editSchema.safeParse(Object.fromEntries(formData));
  if (!ids.success) return { error: "Invalid line." };
  // Kind and source don't change on edit; reuse the line rules for the editable fields.
  const parsed = lineSchema.safeParse({ ...Object.fromEntries(formData), kind: "other" });
  if (!parsed.success) return invalid(parsed.error, formData);
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("estimate_items")
    .update({ description: d.description, quantity: d.quantity, unit_price: d.unitPrice!, discount: d.discount, taxable: d.taxable })
    .eq("id", ids.data.lineId);
  if (error) return { error: message(error, "We couldn't save this line."), values: formValues(formData) };
  paths(ids.data.jobId);
  return { success: "Saved." };
}

export async function removeLine(_: ActionState | undefined, formData: FormData): Promise<ActionState> {
  await requirePermission("estimates.manage");
  const ids = editSchema.safeParse(Object.fromEntries(formData));
  if (!ids.success) return { error: "Invalid line." };
  const supabase = await createClient();
  const { error } = await supabase.from("estimate_items").delete().eq("id", ids.data.lineId);
  if (error) return { error: message(error, "We couldn't remove this line.") };
  paths(ids.data.jobId);
  return { success: "Removed." };
}

// One click turns an inspection finding into a recommended line; staff then set the price.
export async function addFindingLine(formData: FormData) {
  const ctx = await requirePermission("estimates.manage");
  const estimateId = formData.get("estimateId");
  const jobId = formData.get("jobId");
  const category = String(formData.get("category") ?? "") as InspectionCategory;
  if (!isUuid(estimateId) || !isUuid(jobId) || !INSPECTION_CATEGORIES.includes(category)) return;

  const supabase = await createClient();
  const { data: finding } = await supabase
    .from("job_inspection_items")
    .select("outcome, notes, job_inspections!inner(job_card_id)")
    .eq("job_inspections.job_card_id", jobId)
    .eq("category", category)
    .maybeSingle();
  const detail = finding?.notes || (finding ? OUTCOME_LABELS[finding.outcome].toLowerCase() : "");
  await supabase.from("estimate_items").insert({
    workshop_id: ctx.workshop.workshopId,
    estimate_id: estimateId,
    position: await nextPosition(supabase, estimateId),
    kind: "labour",
    source: "recommendation",
    inspection_category: category,
    description: `${CATEGORY_LABELS[category]}${detail ? `: ${detail}` : ""}`.slice(0, 300),
    quantity: 1,
    unit_price: 0,
    discount: 0,
    taxable: true,
  });
  paths(jobId);
}

const detailsSchema = z.object({
  estimateId: z.uuid(),
  jobId: z.uuid(),
  estimatedCompletion: z.string().trim().max(120).default(""),
  terms: z.string().trim().max(2000).default(""),
  customerNote: z.string().trim().max(2000).default(""),
});

export async function saveEstimateDetails(_: ActionState | undefined, formData: FormData): Promise<ActionState> {
  await requirePermission("estimates.manage");
  const parsed = detailsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formData);
  const d = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("estimates")
    .update({
      estimated_completion: d.estimatedCompletion || null,
      terms: d.terms || null,
      customer_note: d.customerNote || null,
    })
    .eq("id", d.estimateId);
  if (error) return { error: message(error, "We couldn't save these details."), values: formValues(formData) };
  paths(d.jobId);
  return { success: "Saved." };
}

const sendSchema = z.object({
  estimateId: z.uuid(),
  jobId: z.uuid(),
  validDays: z.coerce.number().int().min(1).max(60).default(7),
});

export async function sendEstimate(_: LinkState | undefined, formData: FormData): Promise<LinkState> {
  await requirePermission("estimates.manage");
  const parsed = sendSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Invalid request." };
  const supabase = await createClient();
  const { data: token, error } = await supabase.rpc("send_estimate", {
    p_estimate: parsed.data.estimateId,
    p_valid_days: parsed.data.validDays,
  });
  if (error || !token) return { error: message(error, "We couldn't send this estimate.") };
  paths(parsed.data.jobId);
  return { success: "Estimate ready to share. This link is shown once — copy it or send it now.", link: `${siteUrl}/approve/${token}` };
}

export async function renewLink(_: LinkState | undefined, formData: FormData): Promise<LinkState> {
  await requirePermission("estimates.manage");
  const parsed = sendSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Invalid request." };
  const supabase = await createClient();
  const { data: token, error } = await supabase.rpc("renew_estimate_link", {
    p_estimate: parsed.data.estimateId,
    p_valid_days: parsed.data.validDays,
  });
  if (error || !token) return { error: message(error, "We couldn't create a new link.") };
  paths(parsed.data.jobId);
  return { success: "New link created. The previous link no longer works.", link: `${siteUrl}/approve/${token}` };
}

const decisionSchema = z.object({
  estimateId: z.uuid(),
  jobId: z.uuid(),
  method: z.enum(["in_person", "phone", "whatsapp"]),
  note: z.string().trim().max(500).default(""),
});

export async function recordDecision(_: ActionState | undefined, formData: FormData): Promise<ActionState> {
  await requirePermission("estimates.manage");
  const parsed = decisionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Choose how the customer gave their decision." };
  const approved = formData.getAll("approved").map(String).filter(isUuid);
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_estimate_decision", {
    p_estimate: parsed.data.estimateId,
    p_approved: approved,
    p_method: parsed.data.method,
    p_note: parsed.data.note || undefined,
  });
  if (error) return { error: message(error, "We couldn't record this decision.") };
  paths(parsed.data.jobId);
  return { success: "Decision recorded." };
}
