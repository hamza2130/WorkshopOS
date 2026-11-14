"use client";

import { useActionState } from "react";
import { fieldError, FormMessage, SubmitButton } from "@/components/form";
import { Field, Input } from "@/components/ui";
import { addMileageReading } from "../actions";

export function MileageForm({ vehicleId }: { vehicleId: string }) {
  const [state, action] = useActionState(addMileageReading, undefined);
  const err = (name: string) => fieldError(state, name);
  const needsNote = Boolean(err("note"));

  return (
    <form action={action} className="space-y-3" noValidate>
      <input type="hidden" name="vehicleId" value={vehicleId} />
      <FormMessage state={state} />
      <div className="grid gap-3 sm:grid-cols-[160px_1fr_auto] sm:items-end">
        <Field label="Odometer (km)" htmlFor="reading" error={err("reading")}>
          <Input
            id="reading"
            name="reading"
            inputMode="numeric"
            defaultValue={state?.success ? "" : state?.values?.reading}
            aria-invalid={Boolean(err("reading"))}
          />
        </Field>
        <Field label={needsNote ? "Reason (required)" : "Note"} htmlFor="note" error={err("note")}>
          <Input
            id="note"
            name="note"
            placeholder={needsNote ? "e.g. Odometer replaced" : "Optional"}
            defaultValue={state?.success ? "" : state?.values?.note}
            aria-invalid={needsNote}
          />
        </Field>
        <SubmitButton variant="secondary">Add reading</SubmitButton>
      </div>
    </form>
  );
}
