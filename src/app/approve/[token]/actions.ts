"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/forms";
import { isUuid } from "@/lib/params";
import { createClient } from "@/lib/supabase/server";

const ERRORS: Record<string, string> = {
  link_invalid: "This link is no longer valid. Please ask the workshop for a new one.",
  link_expired: "This link has expired. Please ask the workshop for a new one.",
  already_decided: "A decision has already been recorded for this estimate.",
  name_required: "Please enter your name.",
  unknown_item: "Something went wrong. Please refresh the page and try again.",
};

const schema = z.object({
  token: z.string().regex(/^[0-9a-f]{64}$/),
  name: z.string().trim().min(2, "Please enter your name.").max(120),
});

// Public: no login. The unguessable token is the only key, checked in the database.
export async function respondToEstimate(_: ActionState | undefined, formData: FormData): Promise<ActionState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: "Please enter your name.", fieldErrors: { name: ["Please enter your name."] } };
  }
  const approved = formData.get("intent") === "decline" ? [] : formData.getAll("approved").map(String).filter(isUuid);

  const supabase = await createClient();
  const { error } = await supabase.rpc("respond_to_estimate", {
    p_token: parsed.data.token,
    p_approved: approved,
    p_customer_name: parsed.data.name,
  });
  if (error) return { error: ERRORS[error.message] ?? "We couldn't record your decision. Please try again." };
  revalidatePath(`/approve/${parsed.data.token}`);
  return { success: "Thank you — your decision has been sent to the workshop." };
}
