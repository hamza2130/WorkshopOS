import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JobStatusBadge } from "@/components/job-status-badge";
import { PartsUsed } from "@/components/tasks/parts-used";
import { TaskList } from "@/components/tasks/task-list";
import { Alert, Card, cx } from "@/components/ui";
import { requirePageAccess } from "@/lib/auth/session";
import { CATEGORY_LABELS, OUTCOME_LABELS, type InspectionCategory, type InspectionOutcome } from "@/lib/estimates";
import { formatDateTime } from "@/lib/format";
import { CLOSED, FUEL_LEVEL_LABELS, type FuelLevel, type JobStatus } from "@/lib/job-status";
import { isUuid } from "@/lib/params";
import { FUEL_LABELS, TRANSMISSION_LABELS } from "@/lib/record-schemas";
import { getRequestTime } from "@/lib/request-time";
import { createClient } from "@/lib/supabase/server";
import { TASK_STAGES } from "@/lib/tasks";
import { loadJobWork } from "@/lib/work";
import { Attachments, type AttachmentItem } from "../../jobs/[id]/attachments";
import { NoteForm } from "../../jobs/[id]/note-form";

export const metadata: Metadata = { title: "Job" };

// What get_assigned_job() returns: the work, without prices or customer details.
type AssignedJob = {
  id: string;
  workshop_id: string;
  job_number: string;
  status: JobStatus;
  complaint: string;
  initial_observations: string | null;
  check_in_at: string;
  check_in_mileage: number | null;
  fuel_level: FuelLevel | null;
  expected_delivery_at: string | null;
  advisor: string | null;
  vehicle: {
    registration_number: string;
    make: string;
    model: string;
    variant: string | null;
    year: number | null;
    colour: string | null;
    fuel_type: keyof typeof FUEL_LABELS | null;
    transmission: keyof typeof TRANSMISSION_LABELS | null;
  };
  findings: { category: InspectionCategory; outcome: InspectionOutcome; notes: string | null }[];
  approved_work: { id: string; kind: "labour" | "part" | "other"; description: string; quantity: number; part_number: string | null }[];
};

const name = (p: { full_name: string; email: string } | null) => p?.full_name || p?.email || "Someone";

export default async function MyJobPage({ params }: PageProps<"/my-jobs/[id]">) {
  const ctx = await requirePageAccess("jobs.view_assigned");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_assigned_job", { p_job: id });
  const job = data as AssignedJob | null;
  if (!job || job.workshop_id !== ctx.workshop.workshopId) notFound();
  const tz = ctx.workshop.timezone;

  const [work, notes, files] = await Promise.all([
    loadJobWork(id, tz, getRequestTime()),
    supabase
      .from("job_notes")
      .select("id, body, created_at, profiles(full_name, email)")
      .eq("job_card_id", id)
      .eq("visibility", "internal")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("job_attachments")
      .select("id, storage_path, file_name, content_type, category, caption")
      .eq("job_card_id", id)
      .is("removed_at", null)
      .order("uploaded_at"),
  ]);

  const active = files.data ?? [];
  const { data: signed } = active.length
    ? await supabase.storage.from("job-attachments").createSignedUrls(active.map((f) => f.storage_path), 60 * 60)
    : { data: [] };
  const urlFor = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  const attachments: AttachmentItem[] = active.map((f) => ({
    id: f.id,
    url: urlFor.get(f.storage_path) ?? null,
    fileName: f.file_name,
    contentType: f.content_type,
    category: f.category as AttachmentItem["category"],
    caption: f.caption ?? "",
  }));

  const manager = ctx.permissions.has("jobs.manage");
  const canWork = ctx.permissions.has("tasks.update") && TASK_STAGES.includes(job.status);
  const canAdd = ctx.permissions.has("tasks.update") && !CLOSED.includes(job.status);
  // Your own tasks first; the rest of the job's tasks show who else is on it.
  const tasks = [...work.tasks].sort((a, b) => Number(b.assigneeId === ctx.userId) - Number(a.assigneeId === ctx.userId));
  const v = job.vehicle;
  const parts = job.approved_work.filter((w) => w.kind === "part");
  const labour = job.approved_work.filter((w) => w.kind !== "part");

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <Link href="/my-jobs" className="text-sm text-brand-700 hover:underline">
          ← My jobs
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-2xl font-semibold tracking-wide text-slate-900">{v.registration_number}</h1>
            <p className="text-sm text-slate-600">
              {[v.make, v.model, v.variant, v.year].filter(Boolean).join(" ")}
              {v.colour ? ` · ${v.colour}` : ""}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {job.job_number}
              {job.advisor ? ` · Advisor: ${job.advisor}` : ""}
            </p>
          </div>
          <JobStatusBadge status={job.status} />
        </div>
      </div>

      {job.status === "on_hold" ? (
        <Alert tone="info">This job is on hold, so tasks can&apos;t be started or resumed. Ask {job.advisor ?? "the service advisor"} before continuing.</Alert>
      ) : job.status === "quality_check" || job.status === "ready_for_delivery" ? (
        <Alert tone="success">Work is finished and with the advisor for quality check and delivery.</Alert>
      ) : null}

      <Card className="p-4 sm:p-5">
        <h2 className="mb-3 text-base font-semibold text-slate-900">Tasks</h2>
        {tasks.length ? (
          <TaskList jobId={job.id} tasks={tasks} userId={ctx.userId} manager={manager} large canChange={canWork} jobOnHold={job.status === "on_hold"} />
        ) : (
          <p className="text-sm text-slate-600">No tasks on this job.</p>
        )}
      </Card>

      <Card className="p-4 sm:p-5">
        <h2 className="text-base font-semibold text-slate-900">Customer complaint</h2>
        <p className="mt-1.5 whitespace-pre-line text-sm text-slate-800">{job.complaint}</p>
        {job.initial_observations ? (
          <>
            <h3 className="mt-3 text-sm font-semibold text-slate-900">Check-in observations</h3>
            <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{job.initial_observations}</p>
          </>
        ) : null}
        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-slate-500">Odometer</dt>
            <dd className="text-slate-900">{job.check_in_mileage != null ? `${job.check_in_mileage.toLocaleString("en-PK")} km` : "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Fuel</dt>
            <dd className="text-slate-900">{job.fuel_level ? FUEL_LEVEL_LABELS[job.fuel_level] : "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Engine</dt>
            <dd className="text-slate-900">
              {[v.fuel_type ? FUEL_LABELS[v.fuel_type] : null, v.transmission ? TRANSMISSION_LABELS[v.transmission] : null]
                .filter(Boolean)
                .join(" · ") || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Promised</dt>
            <dd className="text-slate-900">{job.expected_delivery_at ? formatDateTime(job.expected_delivery_at, tz) : "—"}</dd>
          </div>
        </dl>
      </Card>

      <Card className="p-4 sm:p-5">
        <h2 className="text-base font-semibold text-slate-900">Approved work</h2>
        {job.approved_work.length ? (
          <ul className="mt-2 divide-y divide-slate-100 text-sm">
            {[...labour, ...parts].map((w) => (
              <li key={w.id} className="flex items-baseline justify-between gap-3 py-2">
                <span className="text-slate-900">
                  {w.description}
                  {w.part_number ? <span className="text-slate-500"> · {w.part_number}</span> : null}
                </span>
                <span className="shrink-0 text-xs text-slate-500">
                  {w.kind === "part" ? `Part × ${Number(w.quantity).toLocaleString("en-PK")}` : "Labour"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1.5 text-sm text-slate-600">Nothing approved yet.</p>
        )}
      </Card>

      {job.findings.length ? (
        <Card className="p-4 sm:p-5">
          <h2 className="text-base font-semibold text-slate-900">Inspection findings</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {job.findings.map((f) => (
              <li key={f.category}>
                <span className="font-medium text-slate-900">{CATEGORY_LABELS[f.category]}</span>{" "}
                <span className={cx("text-xs", f.outcome === "requires_repair" ? "text-red-700" : "text-amber-800")}>
                  {OUTCOME_LABELS[f.outcome]}
                </span>
                {f.notes ? <p className="text-slate-700">{f.notes}</p> : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card className="p-4 sm:p-5">
        <h2 className="mb-3 text-base font-semibold text-slate-900">Parts used</h2>
        <PartsUsed
          jobId={job.id}
          entries={work.parts}
          approvedParts={parts.map((p) => ({ id: p.id, description: p.description, quantity: Number(p.quantity), partNumber: p.part_number }))}
          tasks={work.tasks.filter((t) => t.assigneeId === ctx.userId && t.status !== "cancelled").map((t) => ({ id: t.id, title: t.title }))}
          canRecord={canWork}
          userId={ctx.userId}
          manager={manager}
        />
      </Card>

      <Card className="p-4 sm:p-5">
        <h2 className="mb-3 text-base font-semibold text-slate-900">Photos</h2>
        <Attachments
          jobId={job.id}
          workshopId={ctx.workshop.workshopId}
          items={attachments}
          canEdit={canAdd}
          canRemove={manager}
          defaultCategory="inspection_photo"
        />
      </Card>

      <Card className="p-4 sm:p-5">
        <h2 className="mb-3 text-base font-semibold text-slate-900">Notes for the team</h2>
        {canAdd ? (
          <div className="mb-4">
            <NoteForm key={notes.data?.length ?? 0} jobId={job.id} staffOnly />
          </div>
        ) : null}
        {notes.data?.length ? (
          <ul className="space-y-3">
            {notes.data.map((n) => (
              <li key={n.id} className="text-sm">
                <p className="whitespace-pre-line text-slate-800">{n.body}</p>
                <p className="text-xs text-slate-500">
                  {name(n.profiles)} · {formatDateTime(n.created_at, tz)}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-600">No notes yet.</p>
        )}
      </Card>
    </div>
  );
}
