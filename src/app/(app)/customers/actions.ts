"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ForbiddenError, requirePermission } from "@/lib/auth/session";
import { formValues, invalid, type ActionState } from "@/lib/forms";
import { isUuid } from "@/lib/params";
import { normalizePhone } from "@/lib/phone";
import { customerSchema } from "@/lib/record-schemas";
import { createClient } from "@/lib/supabase/server";

export type DuplicateCustomer = { id: string; code: string; name: string; phone: string; archived: boolean };
export type CustomerState = ActionState & { duplicates?: DuplicateCustomer[] };

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function findDuplicates(supabase: Supabase, workshopId: string, phone: string, excludeId?: string) {
  const normalized = normalizePhone(phone);
  if (!normalized) return [];
  let query = supabase
    .from("customers")
    .select("id, code, name, phone, archived_at")
    .eq("workshop_id", workshopId)
    .eq("phone_normalized", normalized)
    .order("created_at")
    .limit(5);
  if (excludeId) query = query.neq("id", excludeId);
  const { data } = await query;
  return (data ?? []).map((c) => ({ id: c.id, code: c.code, name: c.name, phone: c.phone, archived: c.archived_at !== null }));
}

// Called when the phone field loses focus, so staff see a match before they save.
export async function checkPhone(phone: string, excludeId?: string): Promise<DuplicateCustomer[]> {
  const ctx = await requirePermission("customers.manage");
  const supabase = await createClient();
  return findDuplicates(supabase, ctx.workshop.workshopId, phone, isUuid(excludeId) ? excludeId : undefined);
}

const DUPLICATE_MESSAGE =
  "This phone number already belongs to a customer. Open the existing record, or confirm this is a different person sharing the number.";

export async function saveCustomer(_: CustomerState | undefined, formData: FormData): Promise<CustomerState> {
  const ctx = await requirePermission("customers.manage");
  const rawId = formData.get("customerId");
  const customerId = isUuid(rawId) ? rawId : undefined;
  const parsed = customerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formData);

  const d = parsed.data;
  const wsId = ctx.workshop.workshopId;
  const supabase = await createClient();

  if (!d.confirmSharedPhone) {
    let phoneChanged = true;
    if (customerId) {
      const { data: existing } = await supabase.from("customers").select("phone").eq("id", customerId).maybeSingle();
      phoneChanged = normalizePhone(existing?.phone) !== normalizePhone(d.phone);
    }
    if (phoneChanged) {
      const duplicates = await findDuplicates(supabase, wsId, d.phone, customerId);
      if (duplicates.length) return { error: DUPLICATE_MESSAGE, duplicates, values: formValues(formData) };
    }
  }

  const row = {
    name: d.name,
    phone: d.phone,
    whatsapp: d.whatsapp,
    email: d.email,
    address: d.address,
    notes: d.notes,
    shared_phone_confirmed: d.confirmSharedPhone,
  };
  const result = customerId
    ? await supabase.from("customers").update(row).eq("id", customerId).eq("workshop_id", wsId).select("id").single()
    : await supabase.from("customers").insert({ ...row, workshop_id: wsId }).select("id").single();

  if (result.error) {
    if (result.error.message === "duplicate_phone") {
      // Someone else saved the same number in the meantime; the database caught it.
      const duplicates = await findDuplicates(supabase, wsId, d.phone, customerId);
      return { error: DUPLICATE_MESSAGE, duplicates, values: formValues(formData) };
    }
    return { error: "We couldn't save this customer. Please try again.", values: formValues(formData) };
  }

  revalidatePath("/customers");
  const id = result.data.id;
  if (formData.get("then") === "checkin") redirect(`/vehicles/new?customerId=${id}&then=checkin`);
  redirect(formData.get("intent") === "add-vehicle" ? `/vehicles/new?customerId=${id}` : `/customers/${id}`);
}

export async function setCustomerArchived(_: ActionState | undefined, formData: FormData): Promise<ActionState> {
  const ctx = await requirePermission("customers.manage");
  if (ctx.workshop.role !== "owner") throw new ForbiddenError("workshop.settings");
  const id = formData.get("customerId");
  if (!isUuid(id)) return { error: "Invalid customer." };
  const archive = formData.get("archive") === "true";

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .update({ archived_at: archive ? new Date().toISOString() : null })
    .eq("id", id)
    .eq("workshop_id", ctx.workshop.workshopId)
    .select("id");
  if (error || !data?.length) return { error: "We couldn't update this customer." };

  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  return { success: archive ? "Customer archived." : "Customer restored." };
}
