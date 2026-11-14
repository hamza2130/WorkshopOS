"use client";

import { fieldError } from "@/components/form";
import { Field, Input } from "@/components/ui";
import type { ActionState } from "@/lib/forms";

export type WorkshopFormValues = Partial<
  Record<
    | "name"
    | "phone"
    | "email"
    | "address"
    | "city"
    | "country"
    | "currency"
    | "timezone"
    | "taxLabel"
    | "taxRate"
    | "invoicePrefix"
    | "jobCardPrefix",
    string
  >
>;

export function WorkshopFields({
  state,
  defaults,
  advancedOpen = false,
}: {
  state: ActionState | undefined;
  defaults: WorkshopFormValues;
  advancedOpen?: boolean;
}) {
  const v: WorkshopFormValues = { ...defaults, ...state?.values };
  const err = (name: string) => fieldError(state, name);
  const input = (name: keyof WorkshopFormValues, props: Record<string, unknown> = {}) => (
    <Input id={name} name={name} defaultValue={v[name] ?? ""} aria-invalid={Boolean(err(name))} {...props} />
  );
  const hasAdvancedError = ["country", "currency", "timezone", "taxLabel", "taxRate", "invoicePrefix", "jobCardPrefix"].some(
    (n) => err(n),
  );

  return (
    <div className="space-y-4">
      <Field label="Workshop name" htmlFor="name" error={err("name")}>
        {input("name", { required: true, autoComplete: "organization" })}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Workshop phone" htmlFor="phone" error={err("phone")}>
          {input("phone", { type: "tel", placeholder: "042 1234567" })}
        </Field>
        <Field label="Workshop email" htmlFor="email" hint="Optional" error={err("email")}>
          {input("email", { type: "email" })}
        </Field>
      </div>
      <Field label="Address" htmlFor="address" error={err("address")}>
        {input("address", { autoComplete: "street-address" })}
      </Field>
      <Field label="City" htmlFor="city" error={err("city")}>
        {input("city", { autoComplete: "address-level2" })}
      </Field>

      <details open={advancedOpen || hasAdvancedError} className="rounded-md border border-slate-200 bg-slate-50/60 px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium text-slate-800">
          Region, tax and numbering
          <span className="ml-2 font-normal text-slate-500">Defaults suit Pakistan: PKR, Asia/Karachi</span>
        </summary>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Country code" htmlFor="country" error={err("country")}>
            {input("country", { maxLength: 2 })}
          </Field>
          <Field label="Currency" htmlFor="currency" error={err("currency")}>
            {input("currency", { maxLength: 3 })}
          </Field>
          <Field label="Time zone" htmlFor="timezone" error={err("timezone")}>
            {input("timezone")}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tax label" htmlFor="taxLabel" error={err("taxLabel")}>
              {input("taxLabel")}
            </Field>
            <Field label="Tax rate (%)" htmlFor="taxRate" error={err("taxRate")}>
              {input("taxRate", { inputMode: "decimal" })}
            </Field>
          </div>
          <Field label="Invoice prefix" htmlFor="invoicePrefix" hint="e.g. INV → INV-0001" error={err("invoicePrefix")}>
            {input("invoicePrefix", { maxLength: 10 })}
          </Field>
          <Field label="Job card prefix" htmlFor="jobCardPrefix" hint="e.g. JC → JC-0001" error={err("jobCardPrefix")}>
            {input("jobCardPrefix", { maxLength: 10 })}
          </Field>
        </div>
      </details>
    </div>
  );
}
