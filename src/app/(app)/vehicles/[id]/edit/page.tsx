import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, PageHeader } from "@/components/ui";
import { requirePageAccess } from "@/lib/auth/session";
import { isUuid } from "@/lib/params";
import { createClient } from "@/lib/supabase/server";
import { VehicleForm } from "../../vehicle-form";

export const metadata: Metadata = { title: "Edit vehicle" };

export default async function EditVehiclePage({ params }: PageProps<"/vehicles/[id]/edit">) {
  const ctx = await requirePageAccess("vehicles.manage");
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const supabase = await createClient();
  const { data: v } = await supabase
    .from("vehicles")
    .select("*")
    .eq("id", id)
    .eq("workshop_id", ctx.workshop.workshopId)
    .maybeSingle();
  if (!v) notFound();

  return (
    <>
      <PageHeader title={`Edit ${v.registration_number}`} description="Mileage is recorded separately so earlier readings are never overwritten." />
      <Card className="max-w-3xl p-6">
        <VehicleForm
          vehicleId={v.id}
          isOwner={ctx.workshop.role === "owner"}
          defaults={{
            registrationNumber: v.registration_number,
            make: v.make,
            model: v.model,
            variant: v.variant ?? "",
            year: v.year?.toString() ?? "",
            engineCc: v.engine_cc?.toString() ?? "",
            fuelType: v.fuel_type ?? "",
            transmission: v.transmission ?? "",
            colour: v.colour ?? "",
            vin: v.vin ?? "",
            engineNumber: v.engine_number ?? "",
            notes: v.notes ?? "",
          }}
        />
      </Card>
      <p className="mt-4 text-sm">
        <Link href={`/vehicles/${v.id}`} className="text-brand-700 hover:underline">
          ← Back to {v.registration_number}
        </Link>
      </p>
    </>
  );
}
