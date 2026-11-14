"use client";

import { useActionState } from "react";
import { fieldError, FormMessage, SubmitButton } from "@/components/form";
import { Card, Field, Input } from "@/components/ui";
import { updatePassword } from "../actions";

export default function ResetPasswordPage() {
  const [state, action] = useActionState(updatePassword, undefined);

  return (
    <Card className="p-6 sm:p-8">
      <h1 className="text-xl font-semibold text-slate-900">Choose a new password</h1>
      <form action={action} className="mt-6 space-y-4" noValidate>
        <FormMessage state={state} />
        <Field label="New password" htmlFor="password" hint="At least 8 characters, with letters and numbers." error={fieldError(state, "password")}>
          <Input id="password" name="password" type="password" autoComplete="new-password" required aria-invalid={Boolean(fieldError(state, "password"))} />
        </Field>
        <Field label="Confirm new password" htmlFor="confirmPassword" error={fieldError(state, "confirmPassword")}>
          <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required aria-invalid={Boolean(fieldError(state, "confirmPassword"))} />
        </Field>
        <SubmitButton pendingText="Saving…" className="w-full">
          Save password
        </SubmitButton>
      </form>
    </Card>
  );
}
