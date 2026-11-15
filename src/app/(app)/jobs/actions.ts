"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAnyPermission, requirePermission } from "@/lib/auth/session";
import { zonedLocalToUtc } from "@/lib/datetime";
import { formValues, invalid, type ActionState } from "@/lib/forms";
import { attachmentSchema, createJobSchema, editJobSchema, noteSchema, statusChangeSchema } from "@/lib/job-schema";
import { isJobStatus } from "@/lib/job-status";
import { isUuid } from "@/lib/params";
import { createClient } from "@/lib/supabase/server";

function expectedDelivery(local: string, timeZone: string) {
  return local ? (zonedLocalToUtc(local, timeZone)?.toISOString() ?? null) : null;
}

export async function createJobCard(_: ActionState | undefined, formData: FormData): Promise<ActionState> {
  const ctx = await requirePermission("jobs.manage");
  const vehicleId = formData.get("vehicleId");
  if (!isUuid(vehicleId)) return { error: "Choose a vehicle first." };
  const parsed = createJobSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formData);
  const d = parsed.data;

  const supabase = await createClient();
  const { data: jobId, error } = await supabase.rpc("create_job_card", {
    ws: ctx.workshop.workshopId,
    p_vehicle: vehicleId,
    p_complaint: d.complaint,
    p_mileage: d.mileage ?? undefined,
    p_mileage_note: d.mileageNote ?? undefined,
    p_fuel_level: d.fuelLevel ?? undefined,
    p_observations: d.observations ?? undefined,
    p_advisor: d.advisorId ?? undefined,
    p_expected_delivery: expectedDelivery(d.expectedDelivery, ctx.workshop.timezone) ?? undefined,
    p_as_draft: formData.get("intent") === "draft",
  });

  if (error || !jobId) {
    if (error?.message === "mileage_decrease") {
      return {
        error: error.details ?? "That reading is lower than the last one.",
        fieldErrors: { mileageNote: ["Explain the lower reading, e.g. odometer replaced."] },
        values: formValues(formData),
      };
    }
    return { error: error?.message?.startsWith("Restore") ? error.message : "We couldn't open this job card.", values: formValues(formData) };
  }

  revalidatePath("/jobs");
  redirect(`/jobs/${jobId}`);
}

export async function updateJobCard(_: ActionState | undefined, formData: FormData): Promise<ActionState> {
  const ctx = await requirePermission("jobs.manage");
  const jobId = formData.get("jobId");
  if (!isUuid(jobId)) return { error: "Invalid job card." };
  const parsed = editJobSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formData);
  const d = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_cards")
    .update({
      complaint: d.complaint,
      initial_observations: d.observations,
      fuel_level: d.fuelLevel,
      service_advisor_id: d.advisorId,
      expected_delivery_at: expectedDelivery(d.expectedDelivery, ctx.workshop.timezone),
    })
    .eq("id", jobId)
    .eq("workshop_id", ctx.workshop.workshopId)
    .select("id");
  if (error) {
    return {
      error: error.message === "job_closed" ? "Delivered and cancelled job cards can't be edited." : "We couldn't save these changes.",
      values: formValues(formData),
    };
  }
  if (!data?.length) return { error: "Job card not found." };

  revalidatePath(`/jobs/${jobId}`);
  redirect(`/jobs/${jobId}`);
}

const STATUS_ERRORS: Record<string, string> = {
  status_changed: "Someone else updated this job a moment ago. The page has been refreshed — check the new status.",
  reason_required: "Give a reason for this change.",
  invalid_transition: "That step isn't available for this job any more.",
  tasks_open: "Some tasks aren't finished yet. Complete or cancel them before quality check.",
};

export async function changeJobStatus(_: ActionState | undefined, formData: FormData): Promise<ActionState> {
  await requirePermission("jobs.manage");
  const parsed = statusChangeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Invalid request." };
  const d = parsed.data;
  const expected = d.expectedStatus;
  if (!isJobStatus(expected)) return { error: "Invalid request." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("change_job_status", {
    p_job: d.jobId,
    p_action: d.action,
    p_expected_status: expected,
    p_reason: d.reason ?? undefined,
  });
  revalidatePath(`/jobs/${d.jobId}`);
  revalidatePath("/jobs");
  if (error) {
    return {
      error: STATUS_ERRORS[error.message] ?? "We couldn't update the status.",
      fieldErrors: error.message === "reason_required" ? { reason: ["Required."] } : undefined,
    };
  }
  return { success: "Status updated." };
}

// Advisors, and mechanics on jobs they're assigned to (the database checks the assignment).
export async function addJobNote(_: ActionState | undefined, formData: FormData): Promise<ActionState> {
  const ctx = await requireAnyPermission("jobs.manage", "tasks.update");
  const parsed = noteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formData);

  const supabase = await createClient();
  const { error } = await supabase.from("job_notes").insert({
    workshop_id: ctx.workshop.workshopId,
    job_card_id: parsed.data.jobId,
    body: parsed.data.body,
    // Only advisors write notes the customer can see.
    visibility: ctx.permissions.has("jobs.manage") ? parsed.data.visibility : "internal",
  });
  if (error) return { error: "We couldn't save this note.", values: formValues(formData) };

  revalidatePath(`/jobs/${parsed.data.jobId}`);
  revalidatePath(`/my-jobs/${parsed.data.jobId}`);
  return { success: "Note added.", nonce: Date.now() };
}

// Called by the uploader after the file is already in private storage.
export async function recordAttachment(input: unknown): Promise<ActionState> {
  const ctx = await requireAnyPermission("jobs.manage", "tasks.update");
  const parsed = attachmentSchema.safeParse(input);
  if (!parsed.success) return { error: "That file can't be attached." };
  const d = parsed.data;
  if (!d.path.startsWith(`${ctx.workshop.workshopId}/${d.jobId}/`)) return { error: "Invalid upload location." };

  const supabase = await createClient();
  const { error } = await supabase.from("job_attachments").insert({
    workshop_id: ctx.workshop.workshopId,
    job_card_id: d.jobId,
    storage_path: d.path,
    file_name: d.fileName,
    content_type: d.contentType,
    size_bytes: d.size,
    category: d.category,
  });
  if (error) return { error: `We couldn't attach ${d.fileName}.` };

  revalidatePath(`/jobs/${d.jobId}`);
  revalidatePath(`/my-jobs/${d.jobId}`);
  return { success: "Attached." };
}

export async function removeAttachment(_: ActionState | undefined, formData: FormData): Promise<ActionState> {
  const ctx = await requirePermission("jobs.manage");
  const id = formData.get("attachmentId");
  const jobId = formData.get("jobId");
  if (!isUuid(id) || !isUuid(jobId)) return { error: "Invalid attachment." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_attachments")
    .update({ removed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("workshop_id", ctx.workshop.workshopId)
    .is("removed_at", null)
    .select("id");
  if (error || !data?.length) return { error: "We couldn't remove that file." };

  revalidatePath(`/jobs/${jobId}`);
  return { success: "Removed." };
}
