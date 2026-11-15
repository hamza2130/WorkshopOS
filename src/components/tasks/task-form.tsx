"use client";

import { useActionState } from "react";
import { createTask, updateTask } from "@/app/(app)/jobs/task-actions";
import { fieldError, FormMessage, SubmitButton } from "@/components/form";
import { buttonClass, Field, Input, Select } from "@/components/ui";
import type { ActionState } from "@/lib/forms";
import type { StaffOption } from "@/lib/staff";
import { PRIORITY_LABELS, TASK_PRIORITIES } from "@/lib/tasks";
import type { TaskView } from "@/lib/work";

const textarea =
  "block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100";

export function NewTaskForm({ jobId, mechanics }: { jobId: string; mechanics: StaffOption[] }) {
  const [state, action] = useActionState(createTask, undefined);
  return (
    <form action={action} className="space-y-3" noValidate>
      <input type="hidden" name="jobId" value={jobId} />
      <FormMessage state={state} />
      {/* Re-mounts (clears) after each add; keeps what was typed after an error. */}
      <TaskFields key={state?.nonce ?? 0} idPrefix="new" state={state?.success ? undefined : state} mechanics={mechanics} />
      <SubmitButton pendingText="Adding…">Add task</SubmitButton>
    </form>
  );
}

export function EditTaskForm({
  jobId,
  task,
  mechanics,
  onDone,
}: {
  jobId: string;
  task: TaskView;
  mechanics: StaffOption[];
  onDone: () => void;
}) {
  const [state, action] = useActionState(async (prev: ActionState | undefined, formData: FormData) => {
    const result = await updateTask(prev, formData);
    if (result.success) onDone();
    return result;
  }, undefined);
  return (
    <form action={action} className="space-y-3 rounded-md bg-slate-50 p-3 ring-1 ring-slate-200" noValidate>
      <input type="hidden" name="jobId" value={jobId} />
      <input type="hidden" name="taskId" value={task.id} />
      {state?.error ? <FormMessage state={state} /> : null}
      <TaskFields idPrefix={task.id} state={state} mechanics={mechanics} task={task} />
      <div className="flex flex-wrap gap-2">
        <SubmitButton pendingText="Saving…">Save task</SubmitButton>
        <button type="button" onClick={onDone} className={buttonClass("ghost")}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function TaskFields({
  idPrefix,
  state,
  mechanics,
  task,
}: {
  idPrefix: string;
  state: ActionState | undefined;
  mechanics: StaffOption[];
  task?: TaskView;
}) {
  const v = (name: string, fallback: string) => state?.values?.[name] ?? fallback;
  const id = (name: string) => `${idPrefix}-${name}`;
  const err = (name: string) => fieldError(state, name);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Field label="Task" htmlFor={id("title")} error={err("title")}>
          <Input id={id("title")} name="title" maxLength={200} defaultValue={v("title", task?.title ?? "")} aria-invalid={Boolean(err("title"))} placeholder="e.g. Replace front brake pads" />
        </Field>
      </div>
      <Field label="Mechanic" htmlFor={id("assigneeId")} error={err("assigneeId")}>
        <Select id={id("assigneeId")} name="assigneeId" defaultValue={v("assigneeId", task?.assigneeId ?? "")}>
          <option value="">Not assigned yet</option>
          {mechanics.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Priority" htmlFor={id("priority")}>
        <Select id={id("priority")} name="priority" defaultValue={v("priority", task?.priority ?? "normal")}>
          {TASK_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABELS[p]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Expected done by" htmlFor={id("expectedCompletion")} error={err("expectedCompletion")} hint="Optional">
        <Input id={id("expectedCompletion")} name="expectedCompletion" type="datetime-local" defaultValue={v("expectedCompletion", task?.expectedLocal ?? "")} />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Instructions" htmlFor={id("description")} hint="Optional — what the mechanic should know" error={err("description")}>
          <textarea id={id("description")} name="description" rows={2} maxLength={2000} defaultValue={v("description", task?.description ?? "")} className={textarea} />
        </Field>
      </div>
    </div>
  );
}
