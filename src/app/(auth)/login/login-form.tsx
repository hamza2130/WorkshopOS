"use client";

import { useActionState } from "react";
import { fieldError, FormMessage, SubmitButton } from "@/components/form";
import { Field, Input } from "@/components/ui";
import { signIn } from "../actions";

export function LoginForm({ next, defaultEmail }: { next: string; defaultEmail: string }) {
  const [state, action] = useActionState(signIn, undefined);

  return (
    <form action={action} className="mt-6 space-y-4" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="next" value={next} />
      <Field label="Email" htmlFor="email" error={fieldError(state, "email")}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state?.values?.email ?? defaultEmail}
          aria-invalid={Boolean(fieldError(state, "email"))}
        />
      </Field>
      <Field label="Password" htmlFor="password" error={fieldError(state, "password")}>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={Boolean(fieldError(state, "password"))}
        />
      </Field>
      <SubmitButton pendingText="Logging in…" className="w-full">
        Log in
      </SubmitButton>
    </form>
  );
}
