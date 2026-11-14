import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CustomerPicker } from "@/components/customer-picker";
import { Card, PageHeader } from "@/components/ui";
import { requirePageAccess } from "@/lib/auth/session";
import { isUuid, str, withParams } from "@/lib/params";
import { createClient } from "@/lib/supabase/server";
import { TransferForm } from "./transfer-form";

export const metadata: Metadata = { title: "Transfer vehicle" };

export default async function TransferVehiclePage({ params, searchParams }: PageProps<"/vehicles/[id]/transfer">) {
  const ctx = await requirePageAccess("vehicles.manage");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const sp = await searchParams;
  const toId = str(sp, "to");

  const supabase = await createClient();
  const { data: v } = await supabase
    .from("vehicles")
    .select("id, registration_number, customer_id, customers(name)")
    .eq("id", id)
    .eq("workshop_id", ctx.workshop.workshopId)
    .maybeSingle();
  if (!v) notFound();

  const target =
    isUuid(toId) && toId !== v.customer_id
      ? (
          await supabase
            .from("customers")
            .select("id, name, code")
            .eq("id", toId)
            .eq("workshop_id", ctx.workshop.workshopId)
            .is("archived_at", null)
            .maybeSingle()
        ).data
      : null;

  return (
    <>
      <PageHeader
        title={`Transfer ${v.registration_number}`}
        description={`Currently owned by ${v.customers?.name ?? "—"}. Its mileage and service history move with the vehicle.`}
      />
      <div className="max-w-2xl">
        {target ? (
          <Card className="p-6">
            <p className="mb-4 text-sm text-slate-700">
              Transfer <span className="font-medium text-slate-900">{v.registration_number}</span> from{" "}
              <span className="font-medium text-slate-900">{v.customers?.name}</span> to{" "}
              <span className="font-medium text-slate-900">
                {target.name} ({target.code})
              </span>
              ? This is recorded in the activity log.
            </p>
            <TransferForm vehicleId={v.id} customerId={target.id} label={`Transfer to ${target.name}`} />
          </Card>
        ) : (
          <CustomerPicker
            workshopId={ctx.workshop.workshopId}
            q={str(sp, "q").slice(0, 100)}
            action={`/vehicles/${v.id}/transfer`}
            hrefFor={(customerId) => withParams(`/vehicles/${v.id}/transfer`, { to: customerId })}
            actionLabel="Choose"
            excludeId={v.customer_id}
          />
        )}
      </div>
      <p className="mt-4 text-sm">
        <Link href={`/vehicles/${v.id}`} className="text-brand-700 hover:underline">
          ← Back to {v.registration_number}
        </Link>
      </p>
    </>
  );
}
