"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/form";
import { Select } from "@/components/ui";
import type { StaffOption } from "@/lib/staff";
import { createTasksFromEstimate } from "../task-actions";

export function CreateFromEstimate({ jobId, mechanics, lines }: { jobId: string; mechanics: StaffOption[]; lines: string[] }) {
  const [state, action] = useActionState(createTasksFromEstimate, undefined);
  return (
    <form action={action} className="space-y-3 rounded-md bg-brand-50/60 p-4 ring-1 ring-brand-100">
      <input type="hidden" name="jobId" value={jobId} />
      <FormMessage state={state} />
      <div>
        <p className="text-sm font-medium text-slate-900">
          {lines.length} approved job{lines.length === 1 ? "" : "s"} without a task
        </p>
        <p className="mt-0.5 text-sm text-slate-600">{lines.join(" · ")}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="bulk-assignee" className="text-sm text-slate-700">
          Assign to
        </label>
        <Select id="bulk-assignee" name="assigneeId" defaultValue={mechanics[0]?.id ?? ""} className="w-auto py-1.5">
          <option value="">Nobody yet</option>
          {mechanics.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </Select>
        <SubmitButton pendingText="Creating…" className="py-1.5">
          Create tasks
        </SubmitButton>
      </div>
    </form>
  );
}
