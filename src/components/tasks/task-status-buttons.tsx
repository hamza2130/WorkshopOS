"use client";

import { useActionState, useState } from "react";
import { changeTaskStatus } from "@/app/(app)/jobs/task-actions";
import { fieldError, FormMessage, SubmitButton } from "@/components/form";
import { buttonClass, cx, type ButtonVariant } from "@/components/ui";
import type { TaskMove, TaskStatus } from "@/lib/tasks";

// One tap for the usual reasons; the mechanic can still type their own.
const BLOCK_REASONS = ["Waiting for parts", "Waiting for customer", "Needs another mechanic", "Tool or equipment unavailable"];

const variant = (tone: TaskMove["tone"]): ButtonVariant => (tone === "danger" ? "danger" : tone);

export function TaskStatusButtons({
  jobId,
  taskId,
  status,
  moves,
  large = false,
}: {
  jobId: string;
  taskId: string;
  status: TaskStatus;
  moves: TaskMove[];
  /** Bigger touch targets for the mechanic's phone screen. */
  large?: boolean;
}) {
  const [state, action] = useActionState(changeTaskStatus, undefined);
  const [asking, setAsking] = useState<TaskMove | null>(null);
  const [reason, setReason] = useState("");
  if (moves.length === 0) return null;
  const size = large ? "min-h-11 px-4 text-base" : "px-3 py-1.5";

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="jobId" value={jobId} />
      <input type="hidden" name="taskId" value={taskId} />
      <input type="hidden" name="expected" value={status} />
      {state?.error ? <FormMessage state={state} /> : null}

      {asking ? (
        <div className="space-y-2 rounded-md bg-slate-50 p-3 ring-1 ring-slate-200">
          <input type="hidden" name="to" value={asking.to} />
          <label htmlFor={`reason-${taskId}`} className="block text-sm font-medium text-slate-800">
            {asking.to === "blocked" ? "What's blocking this task?" : `${asking.label} — reason`}
          </label>
          {asking.to === "blocked" ? (
            <div className="flex flex-wrap gap-1.5">
              {BLOCK_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  aria-pressed={reason === r}
                  className={buttonClass(reason === r ? "primary" : "secondary", cx("px-2.5 py-1 text-xs", large && "min-h-9 text-sm"))}
                >
                  {r}
                </button>
              ))}
            </div>
          ) : null}
          <textarea
            id={`reason-${taskId}`}
            name="reason"
            rows={2}
            required
            autoFocus
            maxLength={1000}
            value={reason}
            onChange={(e) => setReason(e.currentTarget.value)}
            aria-invalid={Boolean(fieldError(state, "reason"))}
            placeholder={asking.to === "blocked" ? "e.g. Front pads not in stock, ordered from supplier" : undefined}
            className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100 aria-invalid:border-red-500"
          />
          <p className="text-xs text-slate-500">Kept on the task&apos;s history{asking.to === "blocked" ? " and sent to the service advisor" : ""}.</p>
          <div className="flex flex-wrap gap-2">
            <SubmitButton variant={variant(asking.tone)} pendingText="Saving…" className={size}>
              {asking.to === "blocked" ? "Mark blocked" : `Confirm: ${asking.label}`}
            </SubmitButton>
            <button
              type="button"
              onClick={() => {
                setAsking(null);
                setReason("");
              }}
              className={buttonClass("ghost", size)}
            >
              Back
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {moves.map((m) =>
            m.needsReason ? (
              <button key={m.to + m.label} type="button" onClick={() => setAsking(m)} className={buttonClass(variant(m.tone), size)}>
                {m.label}…
              </button>
            ) : (
              <SubmitButton key={m.to + m.label} name="to" value={m.to} variant={variant(m.tone)} pendingText="Saving…" className={size}>
                {m.label}
              </SubmitButton>
            ),
          )}
        </div>
      )}
    </form>
  );
}
