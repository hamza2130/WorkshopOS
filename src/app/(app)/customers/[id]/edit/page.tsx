import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, PageHeader } from "@/components/ui";
import { requirePageAccess } from "@/lib/auth/session";
import { isUuid } from "@/lib/params";
import { createClient } from "@/lib/supabase/server";
import { CustomerForm } from "../../customer-form";

export const metadata: Metadata = { title: "Edit customer" };

export default async function EditCustomerPage({ params }: PageProps<"/customers/[id]/edit">) {
  const ctx = await requirePageAccess("customers.manage");
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const supabase = await createClient();
  const { data: c } = await supabase
    .from("customers")
    .select("id, name, phone, whatsapp, email, address, notes")
    .eq("id", id)
    .eq("workshop_id", ctx.workshop.workshopId)
    .maybeSingle();
  if (!c) notFound();

  return (
    <>
      <PageHeader title={`Edit ${c.name}`} />
      <Card className="max-w-2xl p-6">
        <CustomerForm
          customerId={c.id}
          defaults={{
            name: c.name,
            phone: c.phone,
            whatsapp: c.whatsapp ?? "",
            email: c.email ?? "",
            address: c.address ?? "",
            notes: c.notes ?? "",
          }}
        />
      </Card>
      <p className="mt-4 text-sm">
        <Link href={`/customers/${c.id}`} className="text-brand-700 hover:underline">
          ← Back to {c.name}
        </Link>
      </p>
    </>
  );
}
