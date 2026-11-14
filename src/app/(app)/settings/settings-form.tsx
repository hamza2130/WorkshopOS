"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/form";
import { WorkshopFields, type WorkshopFormValues } from "@/components/workshop-fields";
import { updateWorkshop } from "./actions";

export function SettingsForm({ defaults }: { defaults: WorkshopFormValues }) {
  const [state, action] = useActionState(updateWorkshop, undefined);
  return (
    <form action={action} className="space-y-5" noValidate>
      <FormMessage state={state} />
      <WorkshopFields state={state} defaults={defaults} advancedOpen />
      <div className="flex justify-end">
        <SubmitButton>Save settings</SubmitButton>
      </div>
    </form>
  );
}
