"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/forms";
import { SubmitButton } from "./form";

export function ArchiveButton({
  action,
  idField,
  id,
  archived,
  noun,
}: {
  action: (state: ActionState | undefined, formData: FormData) => Promise<ActionState>;
  idField: string;
  id: string;
  archived: boolean;
  noun: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!archived && !confirm(`Archive this ${noun}? It will be hidden from lists, but its history is kept and you can restore it.`)) {
          e.preventDefault();
        }
      }}
      className="flex items-center gap-2"
    >
      <input type="hidden" name={idField} value={id} />
      <input type="hidden" name="archive" value={archived ? "false" : "true"} />
      {state?.error ? <span className="text-sm text-red-700">{state.error}</span> : null}
      <SubmitButton variant={archived ? "secondary" : "danger"} pendingText="Updating…">
        {archived ? "Restore" : "Archive"}
      </SubmitButton>
    </form>
  );
}
