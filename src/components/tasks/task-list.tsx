"use client";

import { useState } from "react";
import { Badge, cx } from "@/components/ui";
import type { StaffOption } from "@/lib/staff";
import { OPEN_TASK, PRIORITY_LABELS, TASK_STATUS_LABELS, TASK_STATUS_TONES, taskMoves } from "@/lib/tasks";
import type { TaskView } from "@/lib/work";
import { EditTaskForm } from "./task-form";
import { TaskStatusButtons } from "./task-status-buttons";

export function TaskList({
  jobId,
  tasks,
  userId,
  manager,
  mechanics = [],
  large = false,
  canChange = true,
}: {
  jobId: string;
  tasks: TaskView[];
  userId: string;
  manager: boolean;
  mechanics?: StaffOption[];
  /** Phone layout for mechanics. */
  large?: boolean;
  /** False while the job isn't at a stage where tasks can move (e.g. quality check). */
  canChange?: boolean;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  if (tasks.length === 0) return null;

  return (
    <ul className="divide-y divide-slate-100">
      {tasks.map((t) => {
        const moves = canChange ? taskMoves(t.status, { manager, assignee: t.assigneeId === userId }) : [];
        const mine = t.assigneeId === userId;
        return (
          <li key={t.id} className={cx("py-4 first:pt-0 last:pb-0", t.status === "cancelled" && "opacity-60")}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className={cx("font-medium text-slate-900", large ? "text-base" : "text-sm", t.status === "cancelled" && "line-through")}>
                  {t.title}
                </p>
                <p className="mt-0.5 text-xs text-slate-600">
                  {t.assigneeName ? (mine && !manager ? "You" : t.assigneeName) : "Not assigned"}
                  {t.expectedLabel ? ` · due ${t.expectedLabel}` : ""}
                  {t.completedAtLabel && t.status === "completed" ? ` · done ${t.completedAtLabel}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {t.priority === "high" || t.priority === "urgent" ? (
                  <Badge tone="warning">{PRIORITY_LABELS[t.priority]}</Badge>
                ) : null}
                {t.overdue ? <Badge tone="warning">Overdue</Badge> : null}
                <Badge tone={TASK_STATUS_TONES[t.status]}>{TASK_STATUS_LABELS[t.status]}</Badge>
              </div>
            </div>

            {t.description ? <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{t.description}</p> : null}

            {t.blockedReason ? (
              <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">
                <span className="font-medium">Blocked{t.blockedAtLabel ? ` since ${t.blockedAtLabel}` : ""}:</span> {t.blockedReason}
              </p>
            ) : null}

            {editing === t.id ? (
              <div className="mt-3">
                <EditTaskForm jobId={jobId} task={t} mechanics={mechanics} onDone={() => setEditing(null)} />
              </div>
            ) : moves.length || (manager && OPEN_TASK.includes(t.status)) ? (
              <div className="mt-3 flex flex-wrap items-start gap-2">
                {/* Keyed by status so a stale reason prompt never survives a change. */}
                <TaskStatusButtons key={t.status} jobId={jobId} taskId={t.id} status={t.status} moves={moves} large={large} />
                {manager && OPEN_TASK.includes(t.status) ? (
                  <button
                    type="button"
                    onClick={() => setEditing(t.id)}
                    className="rounded-md px-2 py-1.5 text-sm text-brand-700 hover:bg-brand-50"
                  >
                    Edit or reassign
                  </button>
                ) : null}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
