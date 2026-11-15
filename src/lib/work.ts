import "server-only";
import { utcToZonedLocal } from "./datetime";
import { formatDateTime } from "./format";
import { isOverdue } from "./request-time";
import { createClient } from "./supabase/server";
import { OPEN_TASK, type TaskPriority, type TaskStatus } from "./tasks";

export type TaskView = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string | null;
  assigneeName: string | null;
  fromApprovedWork: boolean;
  /** For the edit form, in the workshop's time zone. */
  expectedLocal: string;
  expectedLabel: string | null;
  overdue: boolean;
  blockedReason: string | null;
  blockedAtLabel: string | null;
  startedAtLabel: string | null;
  completedAtLabel: string | null;
};

export type PartUsedView = {
  id: string;
  description: string;
  quantity: number;
  note: string | null;
  taskTitle: string | null;
  recordedBy: string | null;
  recorderName: string;
  recordedAtLabel: string;
};

export type TaskEvent = {
  id: number;
  at: string;
  who: string;
  taskTitle: string;
  from: TaskStatus | null;
  to: TaskStatus;
  reason: string | null;
};

const personName = (p: { full_name: string; email: string } | null | undefined) => p?.full_name || p?.email || null;

/** Tasks, parts used and task history for one job, as the signed-in user may see them. */
export async function loadJobWork(jobId: string, timeZone: string, now: number) {
  const supabase = await createClient();
  const [tasks, parts, history] = await Promise.all([
    supabase
      .from("job_tasks")
      .select(
        "id, title, description, status, priority, assignee_id, estimate_item_id, expected_completion_at, blocked_reason, blocked_at, started_at, completed_at, assignee:profiles!job_tasks_assignee_id_fkey(full_name, email)",
      )
      .eq("job_card_id", jobId)
      .order("position")
      .order("created_at"),
    supabase
      .from("job_parts_used")
      .select("id, description, quantity, note, task_id, recorded_by, recorded_at, recorder:profiles!job_parts_used_recorded_by_fkey(full_name, email)")
      .eq("job_card_id", jobId)
      .is("removed_at", null)
      .order("recorded_at"),
    supabase
      .from("job_task_history")
      .select("id, task_id, from_status, to_status, reason, changed_at, profiles(full_name, email)")
      .eq("job_card_id", jobId)
      .order("id"),
  ]);

  const taskViews: TaskView[] = (tasks.data ?? []).map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    assigneeId: t.assignee_id,
    assigneeName: personName(t.assignee),
    fromApprovedWork: Boolean(t.estimate_item_id),
    expectedLocal: t.expected_completion_at ? utcToZonedLocal(t.expected_completion_at, timeZone) : "",
    expectedLabel: t.expected_completion_at ? formatDateTime(t.expected_completion_at, timeZone) : null,
    overdue: isOverdue(t.expected_completion_at, !OPEN_TASK.includes(t.status), now),
    blockedReason: t.status === "blocked" ? t.blocked_reason : null,
    blockedAtLabel: t.blocked_at ? formatDateTime(t.blocked_at, timeZone) : null,
    startedAtLabel: t.started_at ? formatDateTime(t.started_at, timeZone) : null,
    completedAtLabel: t.completed_at ? formatDateTime(t.completed_at, timeZone) : null,
  }));
  const titles = new Map(taskViews.map((t) => [t.id, t.title]));

  const partViews: PartUsedView[] = (parts.data ?? []).map((p) => ({
    id: p.id,
    description: p.description,
    quantity: Number(p.quantity),
    note: p.note,
    taskTitle: p.task_id ? (titles.get(p.task_id) ?? null) : null,
    recordedBy: p.recorded_by,
    recorderName: personName(p.recorder) ?? "Someone",
    recordedAtLabel: formatDateTime(p.recorded_at, timeZone),
  }));

  const events: TaskEvent[] = (history.data ?? []).map((h) => ({
    id: h.id,
    at: h.changed_at,
    who: personName(h.profiles) ?? "Someone",
    taskTitle: titles.get(h.task_id) ?? "Task",
    from: h.from_status,
    to: h.to_status,
    reason: h.reason,
  }));

  return { tasks: taskViews, parts: partViews, events };
}
