"use server";

import { redirect } from "next/navigation";
import { setActiveWorkshopCookie } from "@/lib/auth/active-workshop";
import { getMemberships } from "@/lib/auth/session";

export async function switchWorkshop(formData: FormData) {
  const workshopId = String(formData.get("workshopId") ?? "");
  const memberships = await getMemberships();
  if (memberships.some((m) => m.workshopId === workshopId)) {
    await setActiveWorkshopCookie(workshopId);
  }
  redirect("/dashboard");
}
