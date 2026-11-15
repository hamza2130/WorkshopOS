"use server";

import { revalidatePath } from "next/cache";
import { requireAnyPermission, requirePermission } from "@/lib/auth/session";
import { zonedLocalToUtc } from "@/lib/datetime";
import { formValues, invalid, type ActionState } from "@/lib/forms";
import { isUuid } from "@/lib/params";
import { createClient } from "@/lib/supabase/server";
import { partUsedSchema, TASK_ERRORS, taskSchema, taskStatusSchema } from "@/lib/tasks";

// Task screens exist for advisors (/jobs/[id]) and mechanics (/my-jobs/[id]).
function refresh(jobId: string) {
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath(`/my-jobs/${jobId}`);
  revalidatePath("/my-jobs");
}

function friendly(error: { message: string; details?: string | null } | null, fallback: string) {
  if (!error) return fallback;
  if (TASK_ERRORS[error.message]) return TASK_ERRORS[error.message];
  // Guard messages written for people (e.g. "Tasks can only be assigned to …").
  if (error.message.length > 20 && /^[A-Z]/.test(error.message)) return error.message;
  return fallback;
}

export async function createTask(_: ActionState | undefined, formData: FormData): Promise<ActionState> {
  const ctx = await requirePermission("jobs.manage");
  const parsed = taskSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formData);
  const d = parsed.data;

  const supabase = await createClient();
  const { count } = await supabase.from("job_tasks").select("id", { count: "exact", head: true }).eq("job_card_id", d.jobId);
  const { error } = await supabase.from("job_tasks").insert({
    workshop_id: ctx.workshop.workshopId,
    job_card_id: d.jobId,
    position: count ?? 0,
    title: d.title,
    description: d.description,
    assignee_id: d.assigneeId,
    priority: d.priority,
    expected_completion_at: d.expectedCompletion
      ? (zonedLocalToUtc(d.expectedCompletion, ctx.workshop.timezone)?.toISOString() ?? null)
      : null,
  });
  if (error) return { error: friendly(error, "We couldn't add this task."), values: formValues(formData) };

  refresh(d.jobId);
  return { success: `Added “${d.title}”.`, nonce: Date.now() };
}

export async function updateTask(_: ActionState | undefined, formData: FormData): Promise<ActionState> {
  const ctx = await requirePermission("jobs.manage");
  const taskId = formData.get("taskId");
  if (!isUuid(taskId)) return { error: "Invalid task." };
  const parsed = taskSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formData);
  const d = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_tasks")
    .update({
      title: d.title,
      description: d.description,
      assignee_id: d.assigneeId,
      priority: d.priority,
      expected_completion_at: d.expectedCompletion
        ? (zonedLocalToUtc(d.expectedCompletion, ctx.workshop.timezone)?.toISOString() ?? null)
        : null,
    })
    .eq("id", taskId)
    .eq("workshop_id", ctx.workshop.workshopId)
    .select("id");
  if (error) return { error: friendly(error, "We couldn't save this task."), values: formValues(formData) };
  if (!data?.length) return { error: "Task not found." };

  refresh(d.jobId);
  return { success: "Task saved.", nonce: Date.now() };
}

export async function changeTaskStatus(_: ActionState | undefined, formData: FormData): Promise<ActionState> {
  await requireAnyPermission("jobs.manage", "tasks.update");
  const parsed = taskStatusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Invalid request." };
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_task_status", {
    p_task: d.taskId,
    p_status: d.to,
    p_expected_status: d.expected,
    p_reason: d.reason ?? undefined,
  });
  refresh(d.jobId);
  revalidatePath("/jobs");
  if (error) {
    return {
      error: friendly(error, "We couldn't update this task."),
      fieldErrors: error.message === "reason_required" ? { reason: ["Required."] } : undefined,
      values: formValues(formData),
    };
  }
  return { success: "Task updated.", nonce: Date.now() };
}

export async function createTasksFromEstimate(_: ActionState | undefined, formData: FormData): Promise<ActionState> {
  await requirePermission("jobs.manage");
  const jobId = formData.get("jobId");
  const assignee = formData.get("assigneeId");
  if (!isUuid(jobId)) return { error: "Invalid job card." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_tasks_from_estimate", {
    p_job: jobId,
    p_assignee: isUuid(assignee) ? assignee : undefined,
  });
  if (error) return { error: friendly(error, "We couldn't create the tasks.") };

  refresh(jobId);
  return {
    success: data ? `Created ${data} task${data === 1 ? "" : "s"} from the approved work.` : "Every approved job already has a task.",
    nonce: Date.now(),
  };
}

export async function recordPartUsed(_: ActionState | undefined, formData: FormData): Promise<ActionState> {
  const ctx = await requireAnyPermission("jobs.manage", "tasks.update");
  const parsed = partUsedSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formData);
  const d = parsed.data;

  const lineId = d.source.startsWith("line:") ? d.source.slice(5) : null;
  if (lineId !== null && !isUuid(lineId)) return { error: "Invalid part." };
  const description = d.description || formData.get("lineDescription")?.toString().trim() || "";
  if (!description) {
    return { error: "Please fix the highlighted fields.", fieldErrors: { description: ["Describe the part used."] }, values: formValues(formData) };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("job_parts_used").insert({
    workshop_id: ctx.workshop.workshopId,
    job_card_id: d.jobId,
    task_id: d.taskId,
    estimate_item_id: lineId,
    description: description.slice(0, 300),
    quantity: d.quantity,
    note: d.note,
  });
  if (error) return { error: friendly(error, "We couldn't record this part."), values: formValues(formData) };

  refresh(d.jobId);
  return { success: `Recorded ${d.quantity} × ${description}.`, nonce: Date.now() };
}

export async function removePartUsed(_: ActionState | undefined, formData: FormData): Promise<ActionState> {
  const ctx = await requireAnyPermission("jobs.manage", "tasks.update");
  const id = formData.get("partUsedId");
  const jobId = formData.get("jobId");
  if (!isUuid(id) || !isUuid(jobId)) return { error: "Invalid entry." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_parts_used")
    .update({ removed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("workshop_id", ctx.workshop.workshopId)
    .is("removed_at", null)
    .select("id");
  if (error || !data?.length) return { error: friendly(error, "We couldn't remove that entry.") };

  refresh(jobId);
  return { success: "Removed." };
}
