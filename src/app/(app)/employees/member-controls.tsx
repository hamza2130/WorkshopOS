"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/form";
import { Select } from "@/components/ui";
import { GRANTABLE_PERMISSIONS, PERMISSION_LABELS, permissionsFor, ROLE_LABELS, ROLES, type Role } from "@/lib/auth/permissions";
import { revokeInvitation, setMemberActive, updateMember } from "./actions";

export function ManageMember({
  memberId,
  role,
  extraPermissions,
  isActive,
}: {
  memberId: string;
  role: Role;
  extraPermissions: string[];
  isActive: boolean;
}) {
  const [saveState, saveAction] = useActionState(updateMember, undefined);
  const [activeState, activeAction] = useActionState(setMemberActive, undefined);
  const fromRole = permissionsFor(role);
  const grantable = GRANTABLE_PERMISSIONS.filter((p) => !fromRole.has(p));

  return (
    <details className="group">
      <summary className="cursor-pointer list-none rounded-md px-2.5 py-1.5 text-sm text-brand-700 hover:bg-brand-50">Manage</summary>
      <div className="mt-3 space-y-4 rounded-md border border-slate-200 bg-slate-50/60 p-4 text-left">
        {/* Keyed on saved values so the fields re-mount with fresh defaults after a save. */}
        <form key={`${role}|${extraPermissions.join(",")}`} action={saveAction} className="space-y-4">
          <input type="hidden" name="memberId" value={memberId} />
          <div className="space-y-1.5">
            <label htmlFor={`role-${memberId}`} className="block text-sm font-medium text-slate-800">
              Role
            </label>
            <Select id={`role-${memberId}`} name="role" defaultValue={role} className="max-w-60">
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </Select>
          </div>
          {grantable.length > 0 ? (
            <fieldset>
              <legend className="text-sm font-medium text-slate-800">Extra permissions</legend>
              <p className="text-xs text-slate-500">On top of what the role already allows. Saved with the current role.</p>
              <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                {grantable.map((p) => (
                  <label key={p} className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" name="extraPermissions" value={p} defaultChecked={extraPermissions.includes(p)} className="size-4 rounded border-slate-300" />
                    {PERMISSION_LABELS[p]}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}
          <FormMessage state={saveState} />
          <SubmitButton variant="secondary">Save changes</SubmitButton>
        </form>

        <form action={activeAction} className="border-t border-slate-200 pt-4">
          <input type="hidden" name="memberId" value={memberId} />
          <input type="hidden" name="active" value={isActive ? "false" : "true"} />
          <FormMessage state={activeState} />
          <div className="mt-2">
            <SubmitButton variant={isActive ? "danger" : "secondary"} pendingText="Updating…">
              {isActive ? "Deactivate account" : "Reactivate account"}
            </SubmitButton>
          </div>
          {isActive ? <p className="mt-2 text-xs text-slate-500">They lose access immediately. Their history stays on record.</p> : null}
        </form>
      </div>
    </details>
  );
}

export function RevokeInvite({ invitationId }: { invitationId: string }) {
  const [state, action] = useActionState(revokeInvitation, undefined);
  return (
    <form action={action} className="flex items-center justify-end gap-2">
      <input type="hidden" name="invitationId" value={invitationId} />
      {state?.error ? <span className="text-sm text-red-700">{state.error}</span> : null}
      <SubmitButton variant="ghost" pendingText="Revoking…" className="py-1.5">
        Revoke
      </SubmitButton>
    </form>
  );
}
