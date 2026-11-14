"use server";

import { redirect } from "next/navigation";
import { setActiveWorkshopCookie } from "@/lib/auth/active-workshop";
import { requireUser } from "@/lib/auth/session";
import { invalid, formValues, type ActionState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";
import { workshopSchema } from "@/lib/workshop-schema";

export async function createWorkshop(_: ActionState | undefined, formData: FormData): Promise<ActionState> {
  await requireUser();
  const parsed = workshopSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formData);

  const d = parsed.data;
  const supabase = await createClient();
  const { data: workshopId, error } = await supabase.rpc("create_workshop", {
    p_name: d.name,
    p_phone: d.phone ?? undefined,
    p_email: d.email ?? undefined,
    p_address: d.address ?? undefined,
    p_city: d.city ?? undefined,
    p_country: d.country,
    p_currency: d.currency,
    p_timezone: d.timezone,
    p_tax_label: d.taxLabel,
    p_tax_rate: d.taxRate,
    p_invoice_prefix: d.invoicePrefix,
    p_job_card_prefix: d.jobCardPrefix,
  });
  if (error || !workshopId) {
    return { error: "We couldn't create the workshop. Please try again.", values: formValues(formData) };
  }

  await setActiveWorkshopCookie(workshopId);
  redirect("/dashboard");
}
