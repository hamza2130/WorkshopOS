import { Alert, Card } from "@/components/ui";
import { PartsUsed, type ApprovedPart } from "@/components/tasks/parts-used";
import { NewTaskForm } from "@/components/tasks/task-form";
import { TaskList } from "@/components/tasks/task-list";
import type { JobStatus } from "@/lib/job-status";
import type { StaffOption } from "@/lib/staff";
import { TASK_STAGES } from "@/lib/tasks";
import type { PartUsedView, TaskView } from "@/lib/work";
import { CreateFromEstimate } from "./work-forms";

export function WorkPanel({
  jobId,
  status,
  userId,
  tasks,
  parts,
  mechanics,
  approvedParts,
  untaskedLines,
}: {
  jobId: string;
  status: JobStatus;
  userId: string;
  tasks: TaskView[];
  parts: PartUsedView[];
  mechanics: StaffOption[];
  approvedParts: ApprovedPart[];
  untaskedLines: string[];
}) {
  const live = tasks.filter((t) => t.status !== "cancelled");
  const done = live.filter((t) => t.status === "completed").length;
  const blocked = tasks.filter((t) => t.status === "blocked");
  const canPlan = TASK_STAGES.includes(status);
  const allDone = live.length > 0 && done === live.length;

  return (
    <>
      <Card className="p-6">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Work</h2>
          {live.length ? (
            <p className="text-sm text-slate-600">
              {done} of {live.length} task{live.length === 1 ? "" : "s"} done
            </p>
          ) : null}
        </div>

        <div className="space-y-4">
          {blocked.length ? (
            <div role="status" className="rounded-md bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900 ring-1 ring-amber-200">
              <p className="font-medium">{blocked.length === 1 ? "A task is blocked" : `${blocked.length} tasks are blocked`}</p>
              <ul className="mt-1 list-disc pl-5">
                {blocked.map((t) => (
                  <li key={t.id}>
                    {t.title} — {t.blockedReason}
                  </li>
                ))}
              </ul>
              {status === "in_progress" ? (
                <p className="mt-1">If the job can&apos;t continue, put it on hold above so the customer can be told.</p>
              ) : null}
            </div>
          ) : null}
          {allDone && status === "in_progress" ? (
            <Alert tone="success">All tasks are done. Send the job to quality check when you&apos;re ready.</Alert>
          ) : null}

          {canPlan && untaskedLines.length ? (
            <CreateFromEstimate jobId={jobId} mechanics={mechanics} lines={untaskedLines} />
          ) : null}

          {live.length === 0 && !untaskedLines.length && canPlan ? (
            <p className="text-sm text-slate-600">No tasks yet. Add the work the mechanics should do.</p>
          ) : null}

          <TaskList jobId={jobId} tasks={tasks} userId={userId} manager mechanics={mechanics} canChange={canPlan} />

          {canPlan ? (
            <details className="group rounded-md ring-1 ring-slate-200 open:p-4" open={tasks.length === 0 && !untaskedLines.length}>
              <summary className="cursor-pointer list-none px-4 py-2.5 text-sm font-medium text-brand-700 group-open:mb-3 group-open:p-0">
                + Add a task
              </summary>
              <NewTaskForm jobId={jobId} mechanics={mechanics} />
            </details>
          ) : null}
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Parts used</h2>
        <PartsUsed
          jobId={jobId}
          entries={parts}
          approvedParts={approvedParts}
          tasks={live.map((t) => ({ id: t.id, title: t.title }))}
          canRecord={canPlan}
          userId={userId}
          manager
        />
      </Card>
    </>
  );
}
