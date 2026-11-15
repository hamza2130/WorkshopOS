"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/form";
import { Select } from "@/components/ui";
import { addJobNote } from "../actions";

export function NoteForm({ jobId }: { jobId: string }) {
  const [state, action] = useActionState(addJobNote, undefined);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="jobId" value={jobId} />
      {state?.error ? <FormMessage state={state} /> : null}
      <label htmlFor="body" className="sr-only">
        Note
      </label>
      <textarea
        id="body"
        name="body"
        rows={2}
        maxLength={4000}
        placeholder="Add a note…"
        defaultValue={state?.success ? "" : state?.values?.body}
        className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-xs text-slate-600">
          Visible to
          <Select name="visibility" defaultValue="internal" className="w-auto py-1 text-xs">
            <option value="internal">Staff only</option>
            <option value="customer">Customer too</option>
          </Select>
        </label>
        <SubmitButton variant="secondary" pendingText="Adding…" className="py-1.5">
          Add note
        </SubmitButton>
      </div>
    </form>
  );
}
