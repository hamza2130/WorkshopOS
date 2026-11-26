import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, buttonClass, Card, PageHeader } from "@/components/ui";
import { requirePageAccess } from "@/lib/auth/session";
import { CATEGORY_LABELS, INSPECTION_CATEGORIES, OUTCOME_LABELS, OUTCOME_TONES } from "@/lib/estimates";
import { formatDateTime } from "@/lib/format";
import { isUuid } from "@/lib/params";
import { createClient } from "@/lib/supabase/server";
import { startInspection } from "./actions";
import { InspectionForm, type InspectionRow } from "./inspection-form";

export const metadata: Metadata = { title: "Inspection" };

export default async function InspectionPage({ params }: PageProps<"/jobs/[id]/inspection">) {
  const ctx = await requirePageAccess("jobs.manage");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const supabase = await createClient();

  const { data: job } = await supabase
    .from("job_cards")
    .select("id, job_number, status, complaint, vehicles(registration_number, make, model)")
    .eq("id", id)
    .eq("workshop_id", ctx.workshop.workshopId)
    .maybeSingle();
  if (!job) notFound();

  const { data: insp } = await supabase
    .from("job_inspections")
    .select("id, completed_at, summary, completer:profiles!job_inspections_completed_by_fkey(full_name, email), job_inspection_items(category, outcome, notes)")
    .eq("job_card_id", id)
    .maybeSingle();

  const order = new Map(INSPECTION_CATEGORIES.map((c, i) => [c, i]));
  const rows: InspectionRow[] = (insp?.job_inspection_items ?? [])
    .map((r) => ({ category: r.category, outcome: r.outcome, notes: r.notes ?? "" }))
    .sort((a, b) => order.get(a.category)! - order.get(b.category)!);
  const v = job.vehicles;

  return (
    <>
      <PageHeader
        title={`Inspection · ${job.job_number}`}
        description={`${v?.registration_number} · ${v?.make} ${v?.model} — complaint: ${job.complaint}`}
        actions={
          <Link href={`/jobs/${job.id}`} className={buttonClass("secondary")}>
            Back to job card
          </Link>
        }
      />

      {!insp ? (
        <Card className="max-w-xl p-6">
          <p className="text-sm text-slate-700">
            Go through 13 areas of the vehicle and mark each one normal, needs attention, requires repair or not inspected.
            Findings become recommended lines on the estimate.
          </p>
          {["draft", "delivered", "cancelled"].includes(job.status) ? (
            <p className="mt-4 text-sm text-slate-600">Check the vehicle in before inspecting it.</p>
          ) : (
            <form action={startInspection} className="mt-4">
              <input type="hidden" name="jobId" value={job.id} />
              <button type="submit" className={buttonClass("primary")}>
                Start inspection
              </button>
            </form>
          )}
        </Card>
      ) : insp.completed_at ? (
        <div className="max-w-3xl space-y-4">
          <Card className="p-5 text-sm text-slate-700">
            Completed {formatDateTime(insp.completed_at, ctx.workshop.timezone)}
            {insp.completer ? ` by ${insp.completer.full_name || insp.completer.email}` : ""}.
            {insp.summary ? <p className="mt-2 whitespace-pre-line text-slate-900">{insp.summary}</p> : null}
          </Card>
          <Card className="overflow-hidden">
            <ul className="divide-y divide-slate-100">
              {rows.map((r) => (
                <li key={r.category} className="flex flex-wrap items-start justify-between gap-2 px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{CATEGORY_LABELS[r.category]}</p>
                    {r.notes ? <p className="text-sm text-slate-600">{r.notes}</p> : null}
                  </div>
                  <Badge tone={OUTCOME_TONES[r.outcome]}>{OUTCOME_LABELS[r.outcome]}</Badge>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      ) : (
        <div className="max-w-4xl">
          <InspectionForm jobId={job.id} inspectionId={insp.id} rows={rows} summary={insp.summary ?? ""} />
        </div>
      )}
    </>
  );
}
