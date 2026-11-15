"use client";

import { useActionState, useMemo, useState } from "react";
import { fieldError, FormMessage, SubmitButton } from "@/components/form";
import { Field, Input } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import { respondToEstimate } from "./actions";
import type { CustomerEstimate } from "./types";

export function ApprovalForm({ token, data }: { token: string; data: CustomerEstimate }) {
  const [state, action] = useActionState(respondToEstimate, undefined);
  const [chosen, setChosen] = useState<Set<string>>(() => new Set(data.items.map((i) => i.id)));
  const cur = data.workshop.currency;

  // Same rule as the database: tax on the taxable part of the chosen lines.
  const total = useMemo(() => {
    const picked = data.items.filter((i) => chosen.has(i.id));
    const base = picked.reduce((s, i) => s + Number(i.line_total), 0);
    const taxable = picked.filter((i) => i.taxable).reduce((s, i) => s + Number(i.line_total), 0);
    return base + Math.round(taxable * Number(data.estimate.tax_rate)) / 100;
  }, [chosen, data]);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="token" value={token} />
      <FormMessage state={state} />

      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium text-slate-800">Tick the work you want us to do</legend>
        {data.items.map((i) => (
          <label key={i.id} className="flex cursor-pointer items-start gap-3 rounded-md bg-white p-3 ring-1 ring-slate-200 has-checked:ring-brand-600">
            <input
              type="checkbox"
              name="approved"
              value={i.id}
              checked={chosen.has(i.id)}
              onChange={(e) => {
                const next = new Set(chosen);
                if (e.currentTarget.checked) next.add(i.id);
                else next.delete(i.id);
                setChosen(next);
              }}
              className="mt-0.5 size-5 rounded border-slate-300"
            />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-slate-900">{i.description}</span>
              <span className="block text-xs text-slate-500">
                {i.source === "recommendation" ? "Recommended after inspection" : "You asked for this"}
                {Number(i.quantity) !== 1 ? ` · ${Number(i.quantity)} × ${formatMoney(i.unit_price, cur)}` : ""}
                {Number(i.discount) ? ` · ${formatMoney(i.discount, cur)} off` : ""}
              </span>
            </span>
            <span className="text-sm font-medium tabular-nums text-slate-900">{formatMoney(i.line_total, cur)}</span>
          </label>
        ))}
      </fieldset>

      <div className="flex items-baseline justify-between rounded-md bg-brand-50 px-4 py-3 ring-1 ring-brand-100">
        <span className="text-sm text-brand-900">
          Total for selected work{Number(data.estimate.tax_rate) ? ` incl. ${data.estimate.tax_label}` : ""}
        </span>
        <span className="text-lg font-semibold tabular-nums text-brand-900">{formatMoney(total, cur)}</span>
      </div>

      <Field label="Your name" htmlFor="name" error={fieldError(state, "name")}>
        <Input id="name" name="name" autoComplete="name" required defaultValue={data.customer_first_name} />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <SubmitButton name="intent" value="approve" pendingText="Sending…" className="py-3 text-base">
          {chosen.size === data.items.length ? "Approve all work" : `Approve ${chosen.size} selected`}
        </SubmitButton>
        <SubmitButton name="intent" value="decline" variant="secondary" pendingText="Sending…" className="py-3 text-base">
          Decline all
        </SubmitButton>
      </div>
      <p className="text-xs text-slate-500">
        Your decision is recorded with the time and sent to {data.workshop.name}. Questions? Call them
        {data.workshop.phone ? ` on ${data.workshop.phone}` : ""} before deciding.
      </p>
    </form>
  );
}
