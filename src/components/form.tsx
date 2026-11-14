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
}: {
  children: ReactNode;
  pendingText?: string;
  variant?: ButtonVariant;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-disabled={pending} className={buttonClass(variant, className)}>
      {pending ? (pendingText ?? "Saving…") : children}
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
