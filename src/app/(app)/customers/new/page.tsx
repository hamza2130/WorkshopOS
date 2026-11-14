import type { Metadata } from "next";
import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { requirePageAccess } from "@/lib/auth/session";
import { CustomerForm } from "../customer-form";

export const metadata: Metadata = { title: "New customer" };

export default async function NewCustomerPage() {
  await requirePageAccess("customers.manage");
  return (
    <>
      <PageHeader title="New customer" description="We'll check the phone number against your existing customers." />
      <Card className="max-w-2xl p-6">
        <CustomerForm />
      </Card>
      <p className="mt-4 text-sm">
        <Link href="/customers" className="text-brand-700 hover:underline">
          ← Back to customers
        </Link>
      </p>
    </>
  );
}
