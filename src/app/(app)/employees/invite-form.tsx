"use client";

import { useActionState, useState } from "react";
import { fieldError, FormMessage, SubmitButton } from "@/components/form";
import { buttonClass, Field, Input, Select } from "@/components/ui";
import { INVITABLE_ROLES, ROLE_LABELS } from "@/lib/auth/permissions";
import { inviteEmployee } from "./actions";

export function InviteForm({ workshopName }: { workshopName: string }) {
  const [state, action] = useActionState(inviteEmployee, undefined);
  const [copied, setCopied] = useState(false);

  const shareText = state?.inviteUrl
    ? `You've been invited to join ${workshopName} on WorkshopOS. Open this link to accept: ${state.inviteUrl}`
    : "";

  return (
    <div className="space-y-4">
      <form action={action} className="grid gap-4 sm:grid-cols-[1fr_200px_auto] sm:items-end" noValidate>
        <Field label="Employee email" htmlFor="email" error={fieldError(state, "email")}>
          <Input id="email" name="email" type="email" required defaultValue={state?.inviteUrl ? "" : state?.values?.email} aria-invalid={Boolean(fieldError(state, "email"))} />
        </Field>
        <Field label="Role" htmlFor="role" error={fieldError(state, "role")}>
          <Select id="role" name="role" defaultValue={state?.values?.role ?? "mechanic"}>
            {INVITABLE_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </Select>
        </Field>
        <SubmitButton pendingText="Creating…">Create invite</SubmitButton>
      </form>

      {state?.error ? <FormMessage state={state} /> : null}

      {state?.inviteUrl ? (
        <div className="space-y-3 rounded-md bg-emerald-50 p-4 ring-1 ring-emerald-200">
          <p className="text-sm text-emerald-900">{state.success}</p>
          <div className="flex flex-wrap gap-2">
            <Input readOnly value={state.inviteUrl} aria-label="Invite link" className="min-w-0 flex-1 font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
            <button
              type="button"
              className={buttonClass("secondary")}
              onClick={async () => {
                await navigator.clipboard.writeText(state.inviteUrl!);
                setCopied(true);
              }}
            >
              {copied ? "Copied" : "Copy link"}
            </button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClass("secondary")}
            >
              Share on WhatsApp
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}
