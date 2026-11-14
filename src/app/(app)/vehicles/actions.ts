"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ForbiddenError, requirePermission } from "@/lib/auth/session";
import { formValues, invalid, type ActionState } from "@/lib/forms";
import { isUuid } from "@/lib/params";
import { normalizeRegistration } from "@/lib/phone";
import { mileageSchema, vehicleSchema } from "@/lib/record-schemas";
import { createClient } from "@/lib/supabase/server";

export type DuplicateVehicle = {
  id: string;
  registration: string;
  ownerId: string;
  ownerName: string;
};
export type VehicleState = ActionState & { duplicate?: DuplicateVehicle };

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function findDuplicate(supabase: Supabase, workshopId: string, registration: string, excludeId?: string) {
  let query = supabase
    .from("vehicles")
    .select("id, registration_number, customer_id, customers(name)")
    .eq("workshop_id", workshopId)
    .eq("registration_normalized", normalizeRegistration(registration))
    .limit(1);
  if (excludeId) query = query.neq("id", excludeId);
  const { data } = await query;
  const v = data?.[0];
  return v
    ? { id: v.id, registration: v.registration_number, ownerId: v.customer_id, ownerName: v.customers?.name ?? "another customer" }
    : undefined;
}

export async function saveVehicle(_: VehicleState | undefined, formData: FormData): Promise<VehicleState> {
  const ctx = await requirePermission("vehicles.manage");
  const wsId = ctx.workshop.workshopId;
  const rawVehicleId = formData.get("vehicleId");
  const vehicleId = isUuid(rawVehicleId) ? rawVehicleId : undefined;
  const parsed = vehicleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formData);
  const d = parsed.data;
  const supabase = await createClient();

  let customerId: string | undefined;
  let previousRegistration: string | undefined;
  if (vehicleId) {
    const { data: existing } = await supabase.from("vehicles").select("registration_number").eq("id", vehicleId).maybeSingle();
    if (!existing) return { error: "Vehicle not found." };
    previousRegistration = existing.registration_number;
  } else {
    const rawCustomerId = formData.get("customerId");
    if (!isUuid(rawCustomerId)) return { error: "Choose the customer this vehicle belongs to." };
    const { data: customer } = await supabase
      .from("customers")
      .select("id, archived_at")
      .eq("id", rawCustomerId)
      .eq("workshop_id", wsId)
      .maybeSingle();
    if (!customer) return { error: "Customer not found." };
    if (customer.archived_at) return { error: "This customer is archived. Restore them before adding a vehicle." };
    customerId = customer.id;
  }

  const registrationChanged =
    !previousRegistration || normalizeRegistration(previousRegistration) !== normalizeRegistration(d.registrationNumber);
  const duplicate = registrationChanged ? await findDuplicate(supabase, wsId, d.registrationNumber, vehicleId) : undefined;
  const overriding = Boolean(duplicate && d.overrideReason && ctx.workshop.role === "owner");
  if (duplicate && !overriding) {
    return {
      error: `${duplicate.registration} is already registered in this workshop.`,
      duplicate,
      values: formValues(formData),
    };
  }

  const row = {
    registration_number: d.registrationNumber.toUpperCase(),
    make: d.make,
    model: d.model,
    variant: d.variant,
    year: d.year,
    engine_cc: d.engineCc,
    fuel_type: d.fuelType,
    transmission: d.transmission,
    colour: d.colour,
    vin: d.vin,
    engine_number: d.engineNumber,
    notes: d.notes,
    ...(registrationChanged ? { duplicate_registration_reason: overriding ? d.overrideReason : null } : {}),
  };

  const result = vehicleId
    ? await supabase.from("vehicles").update(row).eq("id", vehicleId).eq("workshop_id", wsId).select("id").single()
    : await supabase
        .from("vehicles")
        .insert({ ...row, workshop_id: wsId, customer_id: customerId! })
        .select("id")
        .single();

  if (result.error) {
    if (result.error.message === "duplicate_registration") {
      const dup = await findDuplicate(supabase, wsId, d.registrationNumber, vehicleId);
      return { error: "This registration number is already in use.", duplicate: dup, values: formValues(formData) };
    }
    return { error: "We couldn't save this vehicle. Please try again.", values: formValues(formData) };
  }

  const id = result.data.id;
  if (!vehicleId && d.mileage !== null) {
    await supabase
      .from("vehicle_mileage_readings")
      .insert({ workshop_id: wsId, vehicle_id: id, reading: d.mileage, source: "registration" });
  }

  revalidatePath("/vehicles");
  revalidatePath("/customers", "layout");
  redirect(`/vehicles/${id}`);
}

export async function transferVehicle(_: ActionState | undefined, formData: FormData): Promise<ActionState> {
  const ctx = await requirePermission("vehicles.manage");
  const vehicleId = formData.get("transferVehicleId");
  const customerId = formData.get("customerId");
  if (!isUuid(vehicleId) || !isUuid(customerId)) return { error: "Choose a vehicle and a customer." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vehicles")
    .update({ customer_id: customerId })
    .eq("id", vehicleId)
    .eq("workshop_id", ctx.workshop.workshopId)
    .select("id");
  if (error || !data?.length) return { error: "We couldn't transfer this vehicle." };

  revalidatePath("/vehicles");
  revalidatePath("/customers", "layout");
  redirect(`/vehicles/${vehicleId}`);
}

export async function addMileageReading(_: ActionState | undefined, formData: FormData): Promise<ActionState> {
  const ctx = await requirePermission("vehicles.manage");
  const vehicleId = formData.get("vehicleId");
  if (!isUuid(vehicleId)) return { error: "Invalid vehicle." };
  const parsed = mileageSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formData);

  const supabase = await createClient();
  const { error } = await supabase.from("vehicle_mileage_readings").insert({
    workshop_id: ctx.workshop.workshopId,
    vehicle_id: vehicleId,
    reading: parsed.data.reading!,
    note: parsed.data.note,
    source: "manual",
  });
  if (error) {
    if (error.message === "mileage_decrease") {
      return {
        error: `${error.details ?? "That's lower than the last reading."}`,
        fieldErrors: { note: ["Required when the reading is lower than the last one."] },
        values: formValues(formData),
      };
    }
    return { error: "We couldn't save this reading.", values: formValues(formData) };
  }

  revalidatePath(`/vehicles/${vehicleId}`);
  return { success: "Reading saved." };
}

export async function setVehicleArchived(_: ActionState | undefined, formData: FormData): Promise<ActionState> {
  const ctx = await requirePermission("vehicles.manage");
  if (ctx.workshop.role !== "owner") throw new ForbiddenError("workshop.settings");
  const id = formData.get("vehicleId");
  if (!isUuid(id)) return { error: "Invalid vehicle." };
  const archive = formData.get("archive") === "true";

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vehicles")
    .update({ archived_at: archive ? new Date().toISOString() : null })
    .eq("id", id)
    .eq("workshop_id", ctx.workshop.workshopId)
    .select("id");
  if (error || !data?.length) return { error: "We couldn't update this vehicle." };

  revalidatePath("/vehicles");
  revalidatePath(`/vehicles/${id}`);
  return { success: archive ? "Vehicle archived." : "Vehicle restored." };
}
