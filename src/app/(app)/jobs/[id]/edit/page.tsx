import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Card, PageHeader } from "@/components/ui";
import { requirePageAccess } from "@/lib/auth/session";
import { utcToZonedLocal } from "@/lib/datetime";
import { CLOSED } from "@/lib/job-status";
import { isUuid } from "@/lib/params";
import { getServiceAdvisors } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";
import { JobForm } from "../../job-form";

export const metadata: Metadata = { title: "Edit job card" };

export default async function EditJobPage({ params }: PageProps<"/jobs/[id]/edit">) {
  const ctx = await requirePageAccess("jobs.manage");
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const supabase = await createClient();
  const [{ data: job }, advisors] = await Promise.all([
    supabase
      .from("job_cards")
      .select("id, job_number, status, complaint, initial_observations, fuel_level, service_advisor_id, expected_delivery_at")
      .eq("id", id)
      .eq("workshop_id", ctx.workshop.workshopId)
      .maybeSingle(),
    getServiceAdvisors(ctx.workshop.workshopId),
  ]);
  if (!job) notFound();
  if (CLOSED.includes(job.status)) redirect(`/jobs/${job.id}`);

  // Keep the current advisor selectable even if they no longer run job cards.
  const options =
    job.service_advisor_id && !advisors.some((a) => a.id === job.service_advisor_id)
      ? [...advisors, { id: job.service_advisor_id, name: "Current advisor" }]
      : advisors;

  return (
    <>
      <PageHeader title={`Edit ${job.job_number}`} description="Status changes are made from the job card, so they're always recorded." />
      <Card className="max-w-3xl p-6">
        <JobForm
          mode="edit"
          jobId={job.id}
          advisors={options}
          defaults={{
            complaint: job.complaint,
            observations: job.initial_observations ?? "",
            fuelLevel: job.fuel_level ?? "",
            advisorId: job.service_advisor_id ?? "",
            expectedDelivery: job.expected_delivery_at ? utcToZonedLocal(job.expected_delivery_at, ctx.workshop.timezone) : "",
          }}
        />
      </Card>
      <p className="mt-4 text-sm">
        <Link href={`/jobs/${job.id}`} className="text-brand-700 hover:underline">
          ← Back to {job.job_number}
        </Link>
      </p>
    </>
  );
}
