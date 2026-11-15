"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/form";
import { cx } from "@/components/ui";
import { CATEGORY_LABELS, OUTCOME_LABELS, OUTCOMES, type InspectionCategory, type InspectionOutcome } from "@/lib/estimates";
import { saveInspection } from "./actions";

export type InspectionRow = { category: InspectionCategory; outcome: InspectionOutcome; notes: string };

const OUTCOME_STYLES: Record<InspectionOutcome, string> = {
  normal: "has-checked:bg-emerald-600 has-checked:text-white has-checked:ring-emerald-600",
  needs_attention: "has-checked:bg-amber-500 has-checked:text-white has-checked:ring-amber-500",
  requires_repair: "has-checked:bg-red-600 has-checked:text-white has-checked:ring-red-600",
  not_inspected: "has-checked:bg-slate-600 has-checked:text-white has-checked:ring-slate-600",
};

export function InspectionForm({ jobId, inspectionId, rows }: { jobId: string; inspectionId: string; rows: InspectionRow[] }) {
  const [state, action] = useActionState(saveInspection, undefined);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="jobId" value={jobId} />
      <input type="hidden" name="inspectionId" value={inspectionId} />
      <FormMessage state={state} />

      <ul className="divide-y divide-slate-100 rounded-lg bg-white ring-1 ring-slate-200">
        {rows.map((row) => (
          <li key={row.category} className="grid gap-3 px-5 py-4 md:grid-cols-[180px_1fr]">
            <fieldset className="contents">
              <legend className="pt-1.5 text-sm font-medium text-slate-900">{CATEGORY_LABELS[row.category]}</legend>
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {OUTCOMES.map((o) => (
                    <label
                      key={o}
                      className={cx(
                        "cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-300 has-focus-visible:outline-2 has-focus-visible:outline-brand-600",
                        OUTCOME_STYLES[o],
                      )}
                    >
                      <input type="radio" name={`outcome_${row.category}`} value={o} defaultChecked={row.outcome === o} className="sr-only" />
                      {OUTCOME_LABELS[o]}
                    </label>
                  ))}
                </div>
                <label className="sr-only" htmlFor={`notes_${row.category}`}>
                  {CATEGORY_LABELS[row.category]} notes
                </label>
                <input
                  id={`notes_${row.category}`}
                  name={`notes_${row.category}`}
                  defaultValue={row.notes}
                  maxLength={1000}
                  placeholder="What did you find? e.g. front pads at 2 mm"
                  className="block w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100"
                />
              </div>
            </fieldset>
          </li>
        ))}
      </ul>

      <div className="rounded-lg bg-white p-5 ring-1 ring-slate-200">
        <label htmlFor="summary" className="block text-sm font-medium text-slate-800">
          Summary for the estimate
        </label>
        <p className="text-xs text-slate-500">Optional. Findings marked “needs attention” or “requires repair” are shown to the customer with the estimate.</p>
        <textarea
          id="summary"
          name="summary"
          rows={2}
          maxLength={2000}
          className="mt-2 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
        {/* Save first in the markup so Enter saves rather than completes. */}
        <div className="mt-4 flex flex-row-reverse flex-wrap justify-start gap-3">
          <SubmitButton variant="secondary" name="intent" value="save" pendingText="Saving…">
            Save progress
          </SubmitButton>
          <SubmitButton name="intent" value="complete" pendingText="Completing…">
            Save and complete inspection
          </SubmitButton>
        </div>
        <p className="mt-2 text-xs text-slate-500">Completing locks the inspection and moves the job to “Awaiting estimate”.</p>
      </div>
    </form>
  );
}
