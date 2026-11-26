"use client";

import { useActionState } from "react";
import { fieldError, FormMessage, SubmitButton } from "@/components/form";
import { Field, Input } from "@/components/ui";
import { countStock, receiveStock, saveStockSettings } from "../actions";

const textarea =
  "block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100 aria-invalid:border-red-500";

export function ReceiveForm({ partId, unit, cost, supplier }: { partId: string; unit: string; cost: string; supplier: string }) {
  const [state, action] = useActionState(receiveStock, undefined);
  const v = state?.values;
  return (
    <form key={state?.nonce} action={action} className="space-y-3">
      <input type="hidden" name="partId" value={partId} />
      <FormMessage state={state} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={`Quantity received (${unit})`} htmlFor="rcv-qty" error={fieldError(state, "quantity")}>
          <Input id="rcv-qty" name="quantity" inputMode="decimal" defaultValue={v?.quantity} required autoComplete="off" />
        </Field>
        <Field label="Cost per unit" htmlFor="rcv-cost" error={fieldError(state, "unitCost")} hint="Becomes the part's cost price">
          <Input id="rcv-cost" name="unitCost" inputMode="decimal" defaultValue={v?.unitCost ?? cost} />
        </Field>
        <Field label="Supplier" htmlFor="rcv-supplier">
          <Input id="rcv-supplier" name="supplier" maxLength={120} defaultValue={v?.supplier ?? supplier} />
        </Field>
        <Field label="Supplier bill no." htmlFor="rcv-ref" hint="Optional">
          <Input id="rcv-ref" name="reference" maxLength={120} defaultValue={v?.reference} />
        </Field>
      </div>
      <SubmitButton pendingText="Saving…">Receive stock</SubmitButton>
    </form>
  );
}

export function CountForm({ partId, unit, onHand }: { partId: string; unit: string; onHand: string }) {
  const [state, action] = useActionState(countStock, undefined);
  const v = state?.values;
  return (
    <form key={state?.nonce} action={action} className="space-y-3">
      <input type="hidden" name="partId" value={partId} />
      <FormMessage state={state} />
      <Field label={`Counted on the shelf (${unit})`} htmlFor="cnt-qty" error={fieldError(state, "counted")} hint={`The system says ${onHand}.`}>
        <Input id="cnt-qty" name="counted" inputMode="decimal" defaultValue={v?.counted} required autoComplete="off" />
      </Field>
      <Field label="Reason" htmlFor="cnt-reason" error={fieldError(state, "reason")}>
        <textarea
          id="cnt-reason"
          name="reason"
          rows={2}
          maxLength={500}
          required
          defaultValue={v?.reason}
          aria-invalid={Boolean(fieldError(state, "reason"))}
          placeholder="e.g. Opening stock, monthly count, damaged"
          className={textarea}
        />
      </Field>
      <SubmitButton variant="secondary" pendingText="Saving…">
        Save count
      </SubmitButton>
    </form>
  );
}

export function StockSettingsForm({
  partId,
  trackStock,
  reorderLevel,
  location,
}: {
  partId: string;
  trackStock: boolean;
  reorderLevel: string;
  location: string;
}) {
  const [state, action] = useActionState(saveStockSettings, undefined);
  const v = state?.values;
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="partId" value={partId} />
      {state?.error ? <FormMessage state={state} /> : null}
      <label className="flex items-center gap-2 text-sm text-slate-800">
        <input type="checkbox" name="trackStock" defaultChecked={trackStock} className="size-4 rounded border-slate-300" />
        Track stock for this part
      </label>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Reorder at" htmlFor="set-reorder" error={fieldError(state, "reorderLevel")} hint="Warns when stock falls to this">
          <Input id="set-reorder" name="reorderLevel" inputMode="decimal" defaultValue={v?.reorderLevel ?? reorderLevel} />
        </Field>
        <Field label="Shelf / bin" htmlFor="set-location">
          <Input id="set-location" name="location" maxLength={60} defaultValue={v?.location ?? location} placeholder="e.g. A3" />
        </Field>
      </div>
      <div className="flex items-center gap-3">
        <SubmitButton variant="secondary" pendingText="Saving…" className="py-1.5">
          Save
        </SubmitButton>
        {state?.success ? <span className="text-xs text-emerald-700">{state.success}</span> : null}
      </div>
    </form>
  );
}
