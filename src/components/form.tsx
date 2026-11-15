"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";
import { Alert, buttonClass, type ButtonVariant } from "./ui";
import type { ActionState } from "@/lib/forms";

export function SubmitButton({
  children,
  pendingText,
  variant = "primary",
  className,
  name,
  value,
}: {
  children: ReactNode;
  pendingText?: string;
  variant?: ButtonVariant;
  className?: string;
  name?: string;
  value?: string;
}) {
  const { pending, data } = useFormStatus();
  // With several submit buttons in one form, only the one that was pressed says it's working.
  const pressed = pending && (!name || data?.get(name) === value);
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      aria-disabled={pending}
      className={buttonClass(variant, className)}
    >
      {pressed ? (pendingText ?? "Saving…") : children}
    </button>
  );
}

export function FormMessage({ state }: { state: ActionState | undefined }) {
  if (state?.error) return <Alert tone="error">{state.error}</Alert>;
  if (state?.success) return <Alert tone="success">{state.success}</Alert>;
  return null;
}

export function fieldError(state: ActionState | undefined, name: string) {
  return state?.fieldErrors?.[name]?.[0];
}
