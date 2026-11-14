"use client";

import Link from "next/link";
import { useActionState } from "react";
import { fieldError, FormMessage, SubmitButton } from "@/components/form";
import { Card, Field, Input } from "@/components/ui";
import { requestPasswordReset } from "../actions";

export default function ForgotPasswordPage() {
  const [state, action] = useActionState(requestPasswordReset, undefined);

  return (
    <Card className="p-6 sm:p-8">
      <h1 className="text-xl font-semibold text-slate-900">Reset your password</h1>
      <p className="mt-1 text-sm text-slate-600">We&apos;ll email you a link to choose a new password.</p>
      {state?.success ? (
        <div className="mt-6">
          <FormMessage state={state} />
        </div>
      ) : (
        <form action={action} className="mt-6 space-y-4" noValidate>
          <FormMessage state={state} />
          <Field label="Email" htmlFor="email" error={fieldError(state, "email")}>
            <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={state?.values?.email} aria-invalid={Boolean(fieldError(state, "email"))} />
          </Field>
          <SubmitButton pendingText="Sending…" className="w-full">
            Send reset link
          </SubmitButton>
        </form>
      )}
      <p className="mt-6 text-sm">
        <Link href="/login" className="text-brand-700 hover:underline">
          Back to log in
        </Link>
      </p>
    </Card>
  );
}
