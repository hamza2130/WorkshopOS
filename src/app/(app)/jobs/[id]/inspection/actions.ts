"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/session";
import { OUTCOMES, type InspectionOutcome } from "@/lib/estimates";
import type { ActionState } from "@/lib/forms";
import { isUuid } from "@/lib/params";
import { createClient } from "@/lib/supabase/server";

export async function startInspection(formData: FormData) {
  await requirePermission("jobs.manage");
  const jobId = formData.get("jobId");
  if (!isUuid(jobId)) return;
  const supabase = await createClient();
  await supabase.rpc("start_inspection", { p_job: jobId });
  redirect(`/jobs/${jobId}/inspection`);
}

export async function saveInspection(_: ActionState | undefined, formData: FormData): Promise<ActionState> {
  await requirePermission("jobs.manage");
  const jobId = formData.get("jobId");
  const inspectionId = formData.get("inspectionId");
  if (!isUuid(jobId) || !isUuid(inspectionId)) return { error: "Invalid inspection." };

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("job_inspection_items")
    .select("id, category, outcome, notes")
    .eq("inspection_id", inspectionId);

  const changes = (current ?? []).flatMap((row) => {
    const outcome = String(formData.get(`outcome_${row.category}`) ?? row.outcome);
    const notes = String(formData.get(`notes_${row.category}`) ?? "").trim().slice(0, 1000) || null;
    if (!(OUTCOMES as readonly string[]).includes(outcome)) return [];
    return outcome !== row.outcome || notes !== row.notes ? [{ id: row.id, outcome: outcome as InspectionOutcome, notes }] : [];
  });

  for (const c of changes) {
    const { error } = await supabase.from("job_inspection_items").update({ outcome: c.outcome, notes: c.notes }).eq("id", c.id);
    if (error) {
      return {
        error: error.message === "inspection_completed" ? "This inspection is already complete." : "We couldn't save the inspection.",
      };
    }
  }

  if (formData.get("intent") === "complete") {
    const summary = String(formData.get("summary") ?? "").trim().slice(0, 2000);
    const { error } = await supabase.rpc("complete_inspection", { p_job: jobId, p_summary: summary || undefined });
    if (error) return { error: error.message === "inspection_completed" ? "This inspection is already complete." : "We couldn't complete the inspection." };
    revalidatePath(`/jobs/${jobId}`);
    redirect(`/jobs/${jobId}`);
  }

  revalidatePath(`/jobs/${jobId}/inspection`);
  return { success: changes.length ? `Saved ${changes.length} change${changes.length === 1 ? "" : "s"}.` : "Nothing changed." };
}
