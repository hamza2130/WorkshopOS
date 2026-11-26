"use client";

import { useActionState, useState } from "react";
import { FormMessage, SubmitButton } from "@/components/form";
import { buttonClass, type ButtonVariant } from "@/components/ui";
import type { JobStatus } from "@/lib/job-status";
import { changeJobStatus } from "../actions";

export type StatusAction = { code: string; label: string; requiresReason: boolean; tone: string };

const variant = (tone: string): ButtonVariant => (tone === "primary" ? "primary" : tone === "danger" ? "danger" : "secondary");

export function StatusActions({
  jobId,
  status,
  closed,
  actions,
}: {
  jobId: string;
  status: JobStatus;
  closed: boolean;
  actions: StatusAction[];
}) {
  const [state, action] = useActionState(changeJobStatus, undefined);
  const [asking, setAsking] = useState<StatusAction | null>(null);

  if (actions.length === 0) {
    return closed ? <p className="text-sm text-slate-600">This job is closed. Its history is kept below.</p> : null;
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="jobId" value={jobId} />
      <input type="hidden" name="expectedStatus" value={status} />
      {state?.error ? <FormMessage state={state} /> : null}

      {asking ? (
        <div className="space-y-3 rounded-md bg-slate-50 p-4 ring-1 ring-slate-200">
          <input type="hidden" name="action" value={asking.code} />
          <label htmlFor="reason" className="block text-sm font-medium text-slate-800">
            {asking.label} — reason (shown on the timeline)
          </label>
          <textarea
            id="reason"
            name="reason"
            rows={2}
            required
            autoFocus
            maxLength={500}
            className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
          <div className="flex flex-wrap gap-2">
            <SubmitButton variant={variant(asking.tone)} pendingText="Saving…">
              Confirm: {asking.label}
            </SubmitButton>
            <button type="button" onClick={() => setAsking(null)} className={buttonClass("ghost")}>
              Back
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {actions.map((a) =>
            a.requiresReason ? (
              <button key={a.code} type="button" onClick={() => setAsking(a)} className={buttonClass(variant(a.tone))}>
                {a.label}…
              </button>
            ) : (
              <SubmitButton key={a.code} name="action" value={a.code} variant={variant(a.tone)} pendingText="Saving…">
                {a.label}
              </SubmitButton>
            ),
          )}
        </div>
      )}
    </form>
  );
}
