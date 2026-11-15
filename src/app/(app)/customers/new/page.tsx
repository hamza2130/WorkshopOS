import type { Metadata } from "next";
import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { requirePageAccess } from "@/lib/auth/session";
import { str } from "@/lib/params";
import { CustomerForm } from "../customer-form";

export const metadata: Metadata = { title: "New customer" };

export default async function NewCustomerPage({ searchParams }: PageProps<"/customers/new">) {
  await requirePageAccess("customers.manage");
  const checkin = str(await searchParams, "then") === "checkin";
  return (
    <>
      <PageHeader
        title="New customer"
        description={
          checkin
            ? "Check-in step 1 of 3: customer, then vehicle, then job card."
            : "We'll check the phone number against your existing customers."
        }
      />
      <Card className="max-w-2xl p-6">
        <CustomerForm then={checkin ? "checkin" : undefined} />
      </Card>
      <p className="mt-4 text-sm">
        <Link href={checkin ? "/jobs/new" : "/customers"} className="text-brand-700 hover:underline">
          ← Back
        </Link>
      </p>
    </>
  );
}
