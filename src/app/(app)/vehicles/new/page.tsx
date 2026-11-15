import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CustomerPicker } from "@/components/customer-picker";
import { buttonClass, Card, PageHeader } from "@/components/ui";
import { requirePageAccess } from "@/lib/auth/session";
import { isUuid, str, withParams } from "@/lib/params";
import { createClient } from "@/lib/supabase/server";
import { VehicleForm } from "../vehicle-form";

export const metadata: Metadata = { title: "Add vehicle" };

export default async function NewVehiclePage({ searchParams }: PageProps<"/vehicles/new">) {
  const ctx = await requirePageAccess("vehicles.manage");
  const sp = await searchParams;
  const customerId = str(sp, "customerId");

  if (!customerId) {
    return (
      <>
        <PageHeader
          title="Add vehicle"
          description="First, find the customer who owns it."
          actions={
            <Link href="/customers/new" className={buttonClass("secondary")}>
              New customer
            </Link>
          }
        />
        <div className="max-w-2xl">
          <CustomerPicker
            workshopId={ctx.workshop.workshopId}
            q={str(sp, "q").slice(0, 100)}
            action="/vehicles/new"
            hrefFor={(id) => withParams("/vehicles/new", { customerId: id })}
            actionLabel="Select"
          />
        </div>
      </>
    );
  }

  if (!isUuid(customerId)) notFound();
  const supabase = await createClient();
  const { data: customer } = await supabase
    .from("customers")
    .select("id, name, code, archived_at")
    .eq("id", customerId)
    .eq("workshop_id", ctx.workshop.workshopId)
    .maybeSingle();
  if (!customer) notFound();

  const checkin = str(sp, "then") === "checkin";
  return (
    <>
      <PageHeader
        title="Add vehicle"
        description={`${checkin ? "Check-in step 2 of 3 · " : ""}Owner: ${customer.name} (${customer.code})`}
      />
      <Card className="max-w-3xl p-6">
        <VehicleForm
          customer={{ id: customer.id, name: customer.name }}
          isOwner={ctx.workshop.role === "owner"}
          then={checkin ? "checkin" : undefined}
        />
      </Card>
      <p className="mt-4 text-sm">
        <Link href={`/customers/${customer.id}`} className="text-brand-700 hover:underline">
          ← Back to {customer.name}
        </Link>
      </p>
    </>
  );
}
