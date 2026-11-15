import { z } from "zod";
import type { JobStatus } from "./job-status";
import type { Database } from "./supabase/database.types";

export type TaskStatus = Database["public"]["Enums"]["task_status"];
export type TaskPriority = Database["public"]["Enums"]["task_priority"];

export const TASK_STATUSES: readonly TaskStatus[] = ["pending", "in_progress", "blocked", "completed", "cancelled"];
export const TASK_PRIORITIES: readonly TaskPriority[] = ["low", "normal", "high", "urgent"];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  pending: "To do",
  in_progress: "In progress",
  blocked: "Blocked",
  completed: "Done",
  cancelled: "Cancelled",
};

export const TASK_STATUS_TONES: Record<TaskStatus, "neutral" | "success" | "warning" | "muted"> = {
  pending: "neutral",
  in_progress: "neutral",
  blocked: "warning",
  completed: "success",
  cancelled: "muted",
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

export const OPEN_TASK: readonly TaskStatus[] = ["pending", "in_progress", "blocked"];

// Job stages where tasks can be planned and moved (mirrors guard_job_task()).
// From quality check onwards they are read-only; failing QC reopens the job for work.
export const TASK_STAGES: readonly JobStatus[] = ["approved", "awaiting_assignment", "in_progress", "on_hold"];

export function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === "string" && (TASK_STATUSES as readonly string[]).includes(value);
}

export type TaskMove = { to: TaskStatus; label: string; needsReason: boolean; tone: "primary" | "secondary" | "danger" };

/**
 * The moves a person may make from a task's current status. Mirrors
 * update_task_status() in the database, which has the final say.
 * While the job is on hold, nothing can be started, resumed or reopened.
 */
export function taskMoves(
  status: TaskStatus,
  { manager, assignee, jobOnHold = false }: { manager: boolean; assignee: boolean; jobOnHold?: boolean },
): TaskMove[] {
  const worker = manager || assignee;
  const canStart = !jobOnHold;
  const moves: [allowed: boolean, move: TaskMove][] = [
    [worker && canStart && status === "pending", { to: "in_progress", label: "Start", needsReason: false, tone: "primary" }],
    [worker && status === "in_progress", { to: "completed", label: "Mark done", needsReason: false, tone: "primary" }],
    [worker && canStart && status === "blocked", { to: "in_progress", label: "Resume", needsReason: false, tone: "primary" }],
    [worker && (status === "pending" || status === "in_progress"), { to: "blocked", label: "Blocked", needsReason: true, tone: "secondary" }],
    [manager && canStart && status === "completed", { to: "in_progress", label: "Reopen", needsReason: true, tone: "secondary" }],
    [manager && OPEN_TASK.includes(status), { to: "cancelled", label: "Cancel task", needsReason: true, tone: "danger" }],
  ];
  return moves.filter(([allowed]) => allowed).map(([, move]) => move);
}

export const TASK_ERRORS: Record<string, string> = {
  reason_required: "Give a reason — it's kept on the task's history.",
  status_changed: "Someone else updated this task a moment ago. The page has been refreshed.",
  invalid_transition: "That step isn't available for this task any more.",
  unassigned: "Assign a mechanic before work starts.",
  job_on_hold: "This job is on hold. The advisor needs to resume it first.",
  job_not_in_work: "Tasks can't change at this stage of the job.",
  job_closed: "This job is closed.",
  task_closed: "Reopen the task before changing it.",
  tasks_not_allowed: "Tasks can be planned once the customer has approved the work.",
  no_approved_estimate: "There is no approved estimate on this job yet.",
};

const text = (max: number) =>
  z
    .string()
    .default("")
    .transform((v) => v.trim())
    .pipe(z.string().max(max, `Use at most ${max} characters.`));

const optionalUuid = (message: string) =>
  text(40).pipe(z.union([z.literal("").transform(() => null), z.uuid(message)]));

export const taskSchema = z.object({
  jobId: z.uuid(),
  title: text(200).pipe(z.string().min(2, "Say what needs doing.")),
  description: text(2000).transform((v) => (v === "" ? null : v)),
  assigneeId: optionalUuid("Choose a mechanic."),
  priority: z.enum(TASK_PRIORITIES as [TaskPriority, ...TaskPriority[]]).default("normal"),
  expectedCompletion: text(16).refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v), "Choose a date and time."),
});

export const taskStatusSchema = z.object({
  jobId: z.uuid(),
  taskId: z.uuid(),
  expected: z.enum(TASK_STATUSES as [TaskStatus, ...TaskStatus[]]),
  to: z.enum(TASK_STATUSES as [TaskStatus, ...TaskStatus[]]),
  reason: text(1000).transform((v) => (v === "" ? null : v)),
});

export const partUsedSchema = z.object({
  jobId: z.uuid(),
  taskId: optionalUuid("Choose a task."),
  // "line:<estimate item id>" for an approved part, or "" to describe one.
  source: text(60),
  description: text(300),
  quantity: text(12)
    .refine((v) => /^\d{1,6}(\.\d{1,2})?$/.test(v) && Number(v) > 0, "Enter a quantity, e.g. 1 or 0.5.")
    .transform(Number),
  note: text(500).transform((v) => (v === "" ? null : v)),
});
