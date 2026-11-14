"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/form";
import { WorkshopFields } from "@/components/workshop-fields";
import { WORKSHOP_DEFAULTS } from "@/lib/workshop-schema";
import { createWorkshop } from "./actions";

export function OnboardingForm() {
  const [state, action] = useActionState(createWorkshop, undefined);
  return (
    <form action={action} className="mt-6 space-y-5" noValidate>
      <FormMessage state={state} />
      <WorkshopFields state={state} defaults={WORKSHOP_DEFAULTS} />
      <SubmitButton pendingText="Creating workshop…" className="w-full">
        Create workshop
      </SubmitButton>
    </form>
  );
}
