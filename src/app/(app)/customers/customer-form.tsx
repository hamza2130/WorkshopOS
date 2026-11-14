"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { fieldError, FormMessage, SubmitButton } from "@/components/form";
import { Field, Input } from "@/components/ui";
import { checkPhone, saveCustomer, type DuplicateCustomer } from "./actions";

export type CustomerFormValues = {
  name?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  notes?: string;
};

export function CustomerForm({ customerId, defaults = {} }: { customerId?: string; defaults?: CustomerFormValues }) {
  const [state, action] = useActionState(saveCustomer, undefined);
  const [blurMatches, setBlurMatches] = useState<DuplicateCustomer[]>([]);
  const [checking, startCheck] = useTransition();
  const v = { ...defaults, ...state?.values };
  const initialSame = !defaults.whatsapp || defaults.whatsapp === defaults.phone;
  const [sameAsPhone, setSameAsPhone] = useState(state?.values ? state.values.whatsappSameAsPhone === "on" : initialSame);

  const matches = state?.duplicates?.length ? state.duplicates : blurMatches;
  const err = (name: string) => fieldError(state, name);

  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage state={state} />
      {customerId ? <input type="hidden" name="customerId" value={customerId} /> : null}

      <Field label="Name" htmlFor="name" error={err("name")}>
        <Input id="name" name="name" required autoComplete="off" defaultValue={v.name} aria-invalid={Boolean(err("name"))} />
      </Field>

      <Field label="Phone" htmlFor="phone" hint="Any format: 0300 1234567 or +92 300 1234567" error={err("phone")}>
        <Input
          id="phone"
          name="phone"
          type="tel"
          required
          autoComplete="off"
          defaultValue={v.phone}
          aria-invalid={Boolean(err("phone"))}
          aria-describedby={matches.length ? "phone-matches" : undefined}
          onChange={() => blurMatches.length && setBlurMatches([])}
          onBlur={(e) => {
            const value = e.currentTarget.value;
            if (value.replace(/\D/g, "").length < 7) return;
            startCheck(async () => setBlurMatches(await checkPhone(value, customerId)));
          }}
        />
      </Field>
      {checking ? <p className="-mt-2 text-xs text-slate-500">Checking for existing customers…</p> : null}

      {matches.length ? (
        <div id="phone-matches" role="alert" className="space-y-3 rounded-md bg-amber-50 p-4 ring-1 ring-amber-200">
          <p className="text-sm font-medium text-amber-900">This number already belongs to:</p>
          <ul className="space-y-1">
            {matches.map((m) => (
              <li key={m.id} className="text-sm">
                <Link href={`/customers/${m.id}`} className="font-medium text-brand-700 hover:underline">
                  {m.name}
                </Link>{" "}
                <span className="text-slate-600">
                  · {m.code} · {m.phone}
                  {m.archived ? " · archived" : ""}
                </span>
              </li>
            ))}
          </ul>
          <label className="flex items-start gap-2 text-sm text-amber-900">
            <input type="checkbox" name="confirmSharedPhone" className="mt-0.5 size-4 rounded border-amber-400" />
            This is a different person who shares this number (for example a family member).
          </label>
        </div>
      ) : null}

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          name="whatsappSameAsPhone"
          checked={sameAsPhone}
          onChange={(e) => setSameAsPhone(e.currentTarget.checked)}
          className="size-4 rounded border-slate-300"
        />
        WhatsApp is on the same number
      </label>
      {!sameAsPhone ? (
        <Field label="WhatsApp number" htmlFor="whatsapp" error={err("whatsapp")}>
          <Input id="whatsapp" name="whatsapp" type="tel" defaultValue={v.whatsapp} aria-invalid={Boolean(err("whatsapp"))} />
        </Field>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Email" htmlFor="email" hint="Optional" error={err("email")}>
          <Input id="email" name="email" type="email" defaultValue={v.email} aria-invalid={Boolean(err("email"))} />
        </Field>
        <Field label="Address" htmlFor="address" hint="Optional" error={err("address")}>
          <Input id="address" name="address" defaultValue={v.address} aria-invalid={Boolean(err("address"))} />
        </Field>
      </div>

      <Field label="Notes" htmlFor="notes" hint="Optional — visible to staff only" error={err("notes")}>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={v.notes}
          className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
      </Field>

      <div className="flex flex-wrap justify-end gap-3 pt-2">
        {customerId ? (
          <SubmitButton>Save changes</SubmitButton>
        ) : (
          <>
            <SubmitButton variant="secondary">Save customer</SubmitButton>
            <SubmitButton name="intent" value="add-vehicle" pendingText="Saving…">
              Save and add vehicle
            </SubmitButton>
          </>
        )}
      </div>
    </form>
  );
}
