"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/session";
import { formValues, invalid, type ActionState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";
import { workshopSchema } from "@/lib/workshop-schema";

export async function updateWorkshop(_: ActionState | undefined, formData: FormData): Promise<ActionState> {
  const ctx = await requirePermission("workshop.settings");
  const parsed = workshopSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formData);

  const d = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workshops")
    .update({
      name: d.name,
      phone: d.phone,
      email: d.email,
      address: d.address,
      city: d.city,
      country: d.country,
      currency: d.currency,
      timezone: d.timezone,
      tax_label: d.taxLabel,
      tax_rate: d.taxRate,
      invoice_prefix: d.invoicePrefix,
      job_card_prefix: d.jobCardPrefix,
    })
    .eq("id", ctx.workshop.workshopId)
    .select("id");

  if (error || !data?.length) {
    return { error: "We couldn't save your settings. Please try again.", values: formValues(formData) };
  }
  revalidatePath("/", "layout");
  return { success: "Settings saved." };
}
