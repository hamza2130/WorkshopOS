"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/session";
import { formValues, invalid, type ActionState } from "@/lib/forms";
import { countSchema, formatQty, receiveSchema, STOCK_ERRORS, stockSettingsSchema } from "@/lib/inventory";
import { createClient } from "@/lib/supabase/server";

function refresh(partId: string) {
  revalidatePath(`/inventory/${partId}`);
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
}

const message = (error: { message: string } | null, fallback: string) => (error ? (STOCK_ERRORS[error.message] ?? fallback) : fallback);

export async function receiveStock(_: ActionState | undefined, formData: FormData): Promise<ActionState> {
  await requirePermission("inventory.manage");
  const parsed = receiveSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formData);
  const d = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("receive_stock", {
    p_part: d.partId,
    p_quantity: d.quantity,
    p_unit_cost: d.unitCost ?? undefined,
    p_supplier: d.supplier ?? undefined,
    p_reference: d.reference ?? undefined,
  });
  if (error) return { error: message(error, "We couldn't receive this stock."), values: formValues(formData) };
  refresh(d.partId);
  return { success: `Received ${formatQty(d.quantity)}.`, nonce: Date.now() };
}

export async function countStock(_: ActionState | undefined, formData: FormData): Promise<ActionState> {
  await requirePermission("inventory.manage");
  const parsed = countSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formData);
  const d = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("count_stock", { p_part: d.partId, p_counted: d.counted, p_reason: d.reason });
  if (error) return { error: message(error, "We couldn't save this count."), values: formValues(formData) };
  refresh(d.partId);
  return { success: data ? `Stock set to ${formatQty(d.counted)}.` : "Count matches — nothing to correct.", nonce: Date.now() };
}

export async function saveStockSettings(_: ActionState | undefined, formData: FormData): Promise<ActionState> {
  const ctx = await requirePermission("inventory.manage");
  const parsed = stockSettingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formData);
  const d = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("parts")
    .update({ track_stock: d.trackStock, reorder_level: d.reorderLevel, location: d.location })
    .eq("id", d.partId)
    .eq("workshop_id", ctx.workshop.workshopId)
    .select("id");
  if (error || !data?.length) return { error: message(error, "We couldn't save these settings."), values: formValues(formData) };
  refresh(d.partId);
  return { success: "Saved." };
}
