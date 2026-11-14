import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/ui";
import { requirePageAccess } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const ctx = await requirePageAccess("workshop.settings");
  const supabase = await createClient();
  const { data: w, error } = await supabase.from("workshops").select("*").eq("id", ctx.workshop.workshopId).single();
  if (error) throw error;

  return (
    <>
      <PageHeader title="Settings" description="Workshop profile, region, tax and document numbering." />
      <Card className="max-w-3xl p-6">
        <SettingsForm
          defaults={{
            name: w.name,
            phone: w.phone ?? "",
            email: w.email ?? "",
            address: w.address ?? "",
            city: w.city ?? "",
            country: w.country,
            currency: w.currency,
            timezone: w.timezone,
            taxLabel: w.tax_label,
            taxRate: String(w.tax_rate),
            invoicePrefix: w.invoice_prefix,
            jobCardPrefix: w.job_card_prefix,
          }}
        />
      </Card>
    </>
  );
}
