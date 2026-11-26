"use client";

import { useActionState, useState } from "react";
import { recordPartUsed, removePartUsed } from "@/app/(app)/jobs/task-actions";
import { fieldError, FormMessage, SubmitButton } from "@/components/form";
import { Field, Input, Select } from "@/components/ui";
import type { ActionState } from "@/lib/forms";
import type { PartUsedView } from "@/lib/work";

/** onHand: stock for a tracked catalogue part (advisors only; mechanics don't see the catalogue). */
export type ApprovedPart = { id: string; description: string; quantity: number; partNumber: string | null; onHand?: number | null; unit?: string };
/** A stocked catalogue part an advisor can record directly, when it wasn't on the estimate. */
export type StockPart = { id: string; name: string; partNumber: string | null; onHand: number; unit: string };
export type TaskOption = { id: string; title: string };

const stockNote = (onHand: number | null | undefined, unit = "") =>
  onHand == null ? "" : onHand > 0 ? ` · ${qty(onHand)} ${unit} in stock` : " · none in stock";

const qty = (n: number) => n.toLocaleString("en-PK", { maximumFractionDigits: 2 });

export function PartsUsed({
  jobId,
  entries,
  approvedParts,
  tasks,
  canRecord,
  userId,
  manager,
  stockParts = [],
}: {
  jobId: string;
  entries: PartUsedView[];
  approvedParts: ApprovedPart[];
  tasks: TaskOption[];
  canRecord: boolean;
  userId: string;
  manager: boolean;
  stockParts?: StockPart[];
}) {
  const [state, action] = useActionState(recordPartUsed, undefined);
  return (
    <div className="space-y-4">
      {entries.length ? (
        <ul className="divide-y divide-slate-100 text-sm">
          {entries.map((e) => (
            <li key={e.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0">
              <div className="min-w-0">
                <p className="font-medium text-slate-900">
                  {qty(e.quantity)} × {e.description}
                </p>
                <p className="text-xs text-slate-600">
                  {e.taskTitle ? `${e.taskTitle} · ` : ""}
                  {e.recorderName} · {e.recordedAtLabel}
                </p>
                {e.note ? <p className="mt-0.5 text-xs text-slate-700">{e.note}</p> : null}
              </div>
              {canRecord && (manager || e.recordedBy === userId) ? <RemoveEntry jobId={jobId} id={e.id} /> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-600">No parts recorded yet.</p>
      )}

      {canRecord ? (
        <form action={action} className="space-y-3 border-t border-slate-100 pt-4" noValidate>
          <input type="hidden" name="jobId" value={jobId} />
          <FormMessage state={state} />
          <PartFields
            key={state?.nonce ?? 0}
            state={state?.success ? undefined : state}
            approvedParts={approvedParts}
            stockParts={stockParts}
            tasks={tasks}
          />
          <SubmitButton variant="secondary" pendingText="Recording…">
            Record part used
          </SubmitButton>
        </form>
      ) : null}
    </div>
  );
}

function PartFields({
  state,
  approvedParts,
  stockParts,
  tasks,
}: {
  state: ActionState | undefined;
  approvedParts: ApprovedPart[];
  stockParts: StockPart[];
  tasks: TaskOption[];
}) {
  const [source, setSource] = useState(state?.values?.source ?? (approvedParts[0] ? `line:${approvedParts[0].id}` : ""));
  const line = approvedParts.find((p) => `line:${p.id}` === source);
  const fromStock = stockParts.find((p) => `part:${p.id}` === source);
  const err = (n: string) => fieldError(state, n);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Field label="Part" htmlFor="part-source" hint={fromStock ? "Not on the approved estimate — it's taken from stock and can be billed on the invoice." : undefined}>
          <Select id="part-source" name="source" value={source} onChange={(e) => setSource(e.currentTarget.value)}>
            {approvedParts.length ? (
              <optgroup label="Approved on the estimate">
                {approvedParts.map((p) => (
                  <option key={p.id} value={`line:${p.id}`}>
                    {p.description}
                    {p.partNumber ? ` (${p.partNumber})` : ""} — approved {qty(p.quantity)}
                    {stockNote(p.onHand, p.unit)}
                  </option>
                ))}
              </optgroup>
            ) : null}
            {stockParts.length ? (
              <optgroup label="Other parts in the catalogue">
                {stockParts.map((p) => (
                  <option key={p.id} value={`part:${p.id}`}>
                    {p.name}
                    {p.partNumber ? ` (${p.partNumber})` : ""}
                    {stockNote(p.onHand, p.unit)}
                  </option>
                ))}
              </optgroup>
            ) : null}
            <option value="">Something else (describe it)</option>
          </Select>
        </Field>
      </div>
      {line || fromStock ? (
        <input type="hidden" name="lineDescription" value={line?.description ?? fromStock?.name ?? ""} />
      ) : (
        <div className="sm:col-span-2">
          <Field label="What was used" htmlFor="part-description" error={err("description")}>
            <Input
              id="part-description"
              name="description"
              maxLength={300}
              defaultValue={state?.values?.description ?? ""}
              aria-invalid={Boolean(err("description"))}
              placeholder="e.g. Copper grease"
            />
          </Field>
        </div>
      )}
      <Field label="Quantity" htmlFor="part-quantity" error={err("quantity")}>
        <Input
          id="part-quantity"
          name="quantity"
          inputMode="decimal"
          defaultValue={state?.values?.quantity ?? (line ? String(line.quantity) : "1")}
          aria-invalid={Boolean(err("quantity"))}
        />
      </Field>
      {tasks.length ? (
        <Field label="For task" htmlFor="part-task">
          <Select id="part-task" name="taskId" defaultValue={state?.values?.taskId ?? ""}>
            <option value="">—</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      <div className="sm:col-span-2">
        <Field label="Note" htmlFor="part-note" hint="Optional, e.g. old part kept for the customer">
          <Input id="part-note" name="note" maxLength={500} defaultValue={state?.values?.note ?? ""} />
        </Field>
      </div>
    </div>
  );
}

function RemoveEntry({ jobId, id }: { jobId: string; id: string }) {
  const [state, action] = useActionState(removePartUsed, undefined);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("Remove this entry? It stays in the job's activity log.")) e.preventDefault();
      }}
    >
      <input type="hidden" name="jobId" value={jobId} />
      <input type="hidden" name="partUsedId" value={id} />
      <SubmitButton variant="ghost" pendingText="…" className="px-1.5 py-0.5 text-xs">
        {state?.error ? "Retry" : "Remove"}
      </SubmitButton>
    </form>
  );
}
