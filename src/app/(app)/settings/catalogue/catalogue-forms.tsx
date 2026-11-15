"use client";

import { useActionState } from "react";
import { fieldError, FormMessage, SubmitButton } from "@/components/form";
import { Field, Input } from "@/components/ui";
import { savePart, saveLabour, setCatalogueActive } from "./actions";

type Values = Record<string, string | undefined>;

export function LabourForm({ id, defaults = {} }: { id?: string; defaults?: Values }) {
  const [state, action] = useActionState(saveLabour, undefined);
  const v = { ...defaults, ...(state?.success && !id ? {} : state?.values) };
  const err = (n: string) => fieldError(state, n);
  return (
    <form key={state?.success && !id ? state.success : "form"} action={action} className="space-y-3" noValidate>
      {id ? <input type="hidden" name="id" value={id} /> : null}
      <FormMessage state={state} />
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
        <Field label="Service" htmlFor={`name-${id ?? "new"}`} error={err("name")}>
          <Input id={`name-${id ?? "new"}`} name="name" defaultValue={v.name} placeholder="e.g. Oil change" />
        </Field>
        <Field label="Price" htmlFor={`price-${id ?? "new"}`} error={err("defaultPrice")}>
          <Input id={`price-${id ?? "new"}`} name="defaultPrice" inputMode="decimal" defaultValue={v.defaultPrice} />
        </Field>
        <Field label="Minutes" htmlFor={`min-${id ?? "new"}`} hint="Optional" error={err("estimatedMinutes")}>
          <Input id={`min-${id ?? "new"}`} name="estimatedMinutes" inputMode="numeric" defaultValue={v.estimatedMinutes} />
        </Field>
      </div>
      <Field label="Description" htmlFor={`desc-${id ?? "new"}`} hint="Optional — shown to the customer on estimates" error={err("description")}>
        <Input id={`desc-${id ?? "new"}`} name="description" defaultValue={v.description} />
      </Field>
      <SubmitButton variant={id ? "secondary" : "primary"}>{id ? "Save" : "Add service"}</SubmitButton>
    </form>
  );
}

export function PartForm({ id, defaults = {} }: { id?: string; defaults?: Values }) {
  const [state, action] = useActionState(savePart, undefined);
  const v = { ...defaults, ...(state?.success && !id ? {} : state?.values) };
  const err = (n: string) => fieldError(state, n);
  const f = (name: string, label: string, hint?: string, props: Record<string, unknown> = {}) => (
    <Field label={label} htmlFor={`${name}-${id ?? "new"}`} hint={hint} error={err(name)}>
      <Input id={`${name}-${id ?? "new"}`} name={name} defaultValue={v[name]} {...props} />
    </Field>
  );
  return (
    <form key={state?.success && !id ? state.success : "form"} action={action} className="space-y-3" noValidate>
      {id ? <input type="hidden" name="id" value={id} /> : null}
      <FormMessage state={state} />
      <div className="grid gap-3 sm:grid-cols-3">
        {f("name", "Part", undefined, { placeholder: "e.g. Oil filter" })}
        {f("partNumber", "Part number", "Optional")}
        {f("brand", "Brand", "Optional")}
        {f("sellingPrice", "Selling price", undefined, { inputMode: "decimal" })}
        {f("costPrice", "Cost price", "Optional — staff only", { inputMode: "decimal" })}
        {f("unit", "Unit", "piece, litre, set…")}
        {f("category", "Category", "Optional")}
        {f("supplier", "Supplier", "Optional")}
      </div>
      <SubmitButton variant={id ? "secondary" : "primary"}>{id ? "Save" : "Add part"}</SubmitButton>
    </form>
  );
}

export function ActiveToggle({ id, table, active }: { id: string; table: "parts" | "labour_items"; active: boolean }) {
  const [state, action] = useActionState(setCatalogueActive, undefined);
  return (
    <form action={action} className="inline-flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="table" value={table} />
      <input type="hidden" name="active" value={active ? "false" : "true"} />
      {state?.error ? <span className="text-xs text-red-700">{state.error}</span> : null}
      <SubmitButton variant="ghost" pendingText="…" className="px-2 py-1 text-xs">
        {active ? "Hide" : "Show again"}
      </SubmitButton>
    </form>
  );
}
