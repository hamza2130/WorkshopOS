"use client";

import { useActionState } from "react";
import { fieldError, FormMessage, SubmitButton } from "@/components/form";
import { Field, Input } from "@/components/ui";
import { signUp } from "../actions";

export function RegisterForm({ next, defaultEmail }: { next: string; defaultEmail: string }) {
  const [state, action] = useActionState(signUp, undefined);

  if (state?.success) {
    return (
      <div className="mt-6">
        <FormMessage state={state} />
      </div>
    );
  }

  const v = state?.values ?? {};
  return (
    <form action={action} className="mt-6 space-y-4" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="next" value={next} />
      <Field label="Your name" htmlFor="fullName" error={fieldError(state, "fullName")}>
        <Input id="fullName" name="fullName" autoComplete="name" required defaultValue={v.fullName} aria-invalid={Boolean(fieldError(state, "fullName"))} />
      </Field>
      <Field label="Phone" htmlFor="phone" error={fieldError(state, "phone")}>
        <Input id="phone" name="phone" type="tel" autoComplete="tel" placeholder="0300 1234567" required defaultValue={v.phone} aria-invalid={Boolean(fieldError(state, "phone"))} />
      </Field>
      <Field label="Email" htmlFor="email" error={fieldError(state, "email")}>
        <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={v.email ?? defaultEmail} aria-invalid={Boolean(fieldError(state, "email"))} />
      </Field>
      <Field label="Password" htmlFor="password" hint="At least 8 characters, with letters and numbers." error={fieldError(state, "password")}>
        <Input id="password" name="password" type="password" autoComplete="new-password" required aria-invalid={Boolean(fieldError(state, "password"))} />
      </Field>
      <Field label="Confirm password" htmlFor="confirmPassword" error={fieldError(state, "confirmPassword")}>
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required aria-invalid={Boolean(fieldError(state, "confirmPassword"))} />
      </Field>
      <SubmitButton pendingText="Creating account…" className="w-full">
        Create account
      </SubmitButton>
    </form>
  );
}
