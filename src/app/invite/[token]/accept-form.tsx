"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/form";
import { acceptInvitation } from "./actions";

export function AcceptForm({ token }: { token: string }) {
  const [state, action] = useActionState(acceptInvitation, undefined);
  return (
    <form action={action} className="mt-6 space-y-4">
      <FormMessage state={state} />
      <input type="hidden" name="token" value={token} />
      <SubmitButton pendingText="Joining…" className="w-full">
        Accept and join
      </SubmitButton>
    </form>
  );
}
