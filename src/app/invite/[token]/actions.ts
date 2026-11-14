"use server";

import { redirect } from "next/navigation";
import { setActiveWorkshopCookie } from "@/lib/auth/active-workshop";
import { requireUser } from "@/lib/auth/session";
import type { ActionState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

export async function acceptInvitation(_: ActionState | undefined, formData: FormData): Promise<ActionState> {
  await requireUser();
  const token = String(formData.get("token") ?? "");
  const supabase = await createClient();
  const { data: workshopId, error } = await supabase.rpc("accept_invitation", { p_token: token });
  if (error || !workshopId) {
    return { error: error?.message ?? "This invitation is no longer valid." };
  }
  await setActiveWorkshopCookie(workshopId);
  redirect("/dashboard");
}
