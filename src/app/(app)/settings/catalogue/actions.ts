"use server";

import { revalidatePath } from "next/cache";
import { requireAnyPermission, requirePermission } from "@/lib/auth/session";
import { labourSchema, partSchema } from "@/lib/estimates";
import { formValues, invalid, type ActionState } from "@/lib/forms";
import { isUuid } from "@/lib/params";
import { createClient } from "@/lib/supabase/server";

export async function saveLabour(_: ActionState | undefined, formData: FormData): Promise<ActionState> {
  const ctx = await requirePermission("workshop.settings");
  const parsed = labourSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formData);
  const d = parsed.data;
  const id = formData.get("id");
  const row = {
    name: d.name,
    description: d.description,
    default_price: d.defaultPrice!,
    estimated_minutes: d.estimatedMinutes,
  };

  const supabase = await createClient();
  const { error } = isUuid(id)
    ? await supabase.from("labour_items").update(row).eq("id", id).eq("workshop_id", ctx.workshop.workshopId)
    : await supabase.from("labour_items").insert({ ...row, workshop_id: ctx.workshop.workshopId });
  if (error) {
    return {
      error: error.code === "23505" ? "A service with this name already exists." : "We couldn't save this service.",
      values: formValues(formData),
    };
  }
  revalidatePath("/settings/catalogue");
  return { success: isUuid(id) ? "Saved." : `Added ${d.name}.` };
}

// Owners (settings) and inventory managers look after parts; the database checks the same.
export async function savePart(_: ActionState | undefined, formData: FormData): Promise<ActionState> {
  const ctx = await requireAnyPermission("workshop.settings", "inventory.manage");
  const parsed = partSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formData);
  const d = parsed.data;
  const id = formData.get("id");
  const row = {
    name: d.name,
    part_number: d.partNumber,
    brand: d.brand,
    category: d.category,
    supplier: d.supplier,
    cost_price: d.costPrice,
    selling_price: d.sellingPrice!,
    unit: d.unit,
  };

  const supabase = await createClient();
  const { error } = isUuid(id)
    ? await supabase.from("parts").update(row).eq("id", id).eq("workshop_id", ctx.workshop.workshopId)
    : await supabase.from("parts").insert({ ...row, workshop_id: ctx.workshop.workshopId });
  if (error) return { error: "We couldn't save this part.", values: formValues(formData) };
  revalidatePath("/settings/catalogue");
  revalidatePath("/inventory");
  if (isUuid(id)) revalidatePath(`/inventory/${id}`);
  return { success: isUuid(id) ? "Saved." : `Added ${d.name}.` };
}

export async function setCatalogueActive(_: ActionState | undefined, formData: FormData): Promise<ActionState> {
  const table = formData.get("table") === "parts" ? "parts" : "labour_items";
  const ctx = table === "parts" ? await requireAnyPermission("workshop.settings", "inventory.manage") : await requirePermission("workshop.settings");
  const id = formData.get("id");
  if (!isUuid(id)) return { error: "Invalid item." };
  const supabase = await createClient();
  const { error } = await supabase
    .from(table)
    .update({ is_active: formData.get("active") === "true" })
    .eq("id", id)
    .eq("workshop_id", ctx.workshop.workshopId);
  if (error) return { error: "We couldn't update this item." };
  revalidatePath("/settings/catalogue");
  revalidatePath("/inventory");
  return { success: "Updated." };
}
