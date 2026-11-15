"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getWorkshopContext } from "@/lib/auth/session";
import { isUuid } from "@/lib/params";
import { createClient } from "@/lib/supabase/server";

// Opening a notification marks it read, then goes to what it's about.
export async function openNotification(formData: FormData) {
  await getWorkshopContext();
  const id = formData.get("id");
  const link = String(formData.get("link") ?? "/dashboard");
  if (isUuid(id)) {
    const supabase = await createClient();
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id).is("read_at", null);
  }
  revalidatePath("/", "layout");
  redirect(link.startsWith("/") && !link.startsWith("//") ? link : "/dashboard");
}

export async function markAllRead() {
  const ctx = await getWorkshopContext();
  const supabase = await createClient();
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", ctx.userId)
    .eq("workshop_id", ctx.workshop.workshopId)
    .is("read_at", null);
  revalidatePath("/", "layout");
}
