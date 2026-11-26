import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JobStatusBadge } from "@/components/job-status-badge";
import { Alert, Badge, buttonClass, Card, PageHeader } from "@/components/ui";
import { isPermission } from "@/lib/auth/permissions";
import { requirePageAccess } from "@/lib/auth/session";
import { ESTIMATE_STATUS_LABELS } from "@/lib/estimates";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/format";
import { ATTACHMENT_CATEGORY_LABELS } from "@/lib/job-schema";
import { CLOSED, FUEL_LEVEL_LABELS, JOB_STATUS_LABELS, SYSTEM_ACTION_LABELS, type JobStatus } from "@/lib/job-status";
import { isUuid } from "@/lib/params";
import { whatsappLink } from "@/lib/phone";
import { getRequestTime, isOverdue } from "@/lib/request-time";
import { getMechanics } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";
import { OPEN_TASK, TASK_STAGES, TASK_STATUS_LABELS } from "@/lib/tasks";
import { loadJobWork } from "@/lib/work";
import { startEstimate } from "./estimate/actions";
import { startInspection } from "./inspection/actions";
import { Attachments, type AttachmentItem } from "./attachments";
import { NoteForm } from "./note-form";
import { StatusActions } from "./status-actions";
import { WorkPanel } from "./work-panel";

export const metadata: Metadata = { title: "Job card" };

type TimelineEvent = {
  key: string;
  at: string;
  who: string;
  title: string;
  detail?: string | null;
  badge?: string;
  tone?: "status" | "note" | "file" | "task";
};

const name = (p: { full_name: string; email: string } | null) => p?.full_name || p?.email || "Someone";

export default async function JobPage({ params }: PageProps<"/jobs/[id]">) {
  const ctx = await requirePageAccess("jobs.manage");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const tz = ctx.workshop.timezone;
  const supabase = await createClient();

  const { data: job } = await supabase
    .from("job_cards")
    .select(
      "*, customers(id, name, code, phone, whatsapp), vehicles(id, registration_number, make, model, variant, year, colour), advisor:profiles!job_cards_service_advisor_id_fkey(full_name, email)",
    )
    .eq("id", id)
    .eq("workshop_id", ctx.workshop.workshopId)
    .maybeSingle();
  if (!job || !job.customers || !job.vehicles) notFound();

  const now = getRequestTime();
  const [history, notes, files, actions, inspection, estimates, work, mechanics, approved] = await Promise.all([
    supabase
      .from("job_status_history")
      .select("id, from_status, to_status, action, reason, changed_at, profiles(full_name, email)")
      .eq("job_card_id", id)
      .order("id"),
    supabase
      .from("job_notes")
      .select("id, body, visibility, created_at, profiles(full_name, email)")
      .eq("job_card_id", id)
      .order("created_at"),
    supabase
      .from("job_attachments")
      .select("id, storage_path, file_name, content_type, category, caption, uploaded_at, removed_at, uploader:profiles!job_attachments_uploaded_by_fkey(full_name, email), remover:profiles!job_attachments_removed_by_fkey(full_name, email)")
      .eq("job_card_id", id)
      .order("uploaded_at"),
    supabase.from("job_status_actions").select("code, label, from_status, requires_reason, tone, sort_order, permission").order("sort_order"),
    supabase.from("job_inspections").select("completed_at, job_inspection_items(outcome)").eq("job_card_id", id).maybeSingle(),
    supabase.from("estimates").select("version, status, total").eq("job_card_id", id).order("version", { ascending: false }).limit(1),
    loadJobWork(id, tz, now),
    getMechanics(ctx.workshop.workshopId),
    // The approved lines of the latest approved version: what the mechanics work from.
    supabase
      .from("estimates")
      .select("version, estimate_items(id, kind, description, quantity, part_number, position, approval_status)")
      .eq("job_card_id", id)
      .in("status", ["approved", "partially_approved"])
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const approvedLines = (approved.data?.estimate_items ?? [])
    .filter((i) => i.approval_status === "approved")
    .sort((a, b) => a.position - b.position);
  // Cancelled tasks count too: the advisor dropped that work on purpose.
  const taskTitles = new Set(work.tasks.map((t) => t.title.trim().toLowerCase()));
  const untaskedLines = approvedLines
    .filter((i) => i.kind !== "part" && i.description.trim().length >= 2 && !taskTitles.has(i.description.trim().slice(0, 200).toLowerCase()))
    .map((i) => i.description);
  const approvedParts = approvedLines
    .filter((i) => i.kind === "part")
    .map((i) => ({ id: i.id, description: i.description, quantity: Number(i.quantity), partNumber: i.part_number }));

  const active = (files.data ?? []).filter((f) => !f.removed_at);
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

  const actionLabel = new Map((actions.data ?? []).map((a) => [a.code, a.label]));
  const openTasks = work.tasks.filter((t) => OPEN_TASK.includes(t.status)).length;
  const planning = (job.status === "approved" || job.status === "awaiting_assignment") && !work.tasks.length;
  // Inspection, estimate and approval moves happen through their own screens ("system").
  const available = (actions.data ?? [])
    .filter((a) => a.from_status === job.status && isPermission(a.permission) && ctx.permissions.has(a.permission))
    // The database refuses quality check while tasks are open; don't offer a button that can only fail.
    .filter((a) => !(a.code === "finish_work" && openTasks > 0))
    .map((a) => ({
      code: a.code,
      label: a.label,
      requiresReason: a.requires_reason,
      // While the work still needs planning, that is the main thing to do — not a status change.
      tone: planning && a.code === "request_assignment" ? "secondary" : a.tone,
    }));
  const insp = inspection.data;
  const findingsCount = (insp?.job_inspection_items ?? []).filter((i) => i.outcome === "needs_attention" || i.outcome === "requires_repair").length;
  const latestEstimate = estimates.data?.[0];

  const events: TimelineEvent[] = [
    ...(history.data ?? []).map((h) => ({
      key: `h${h.id}`,
      at: h.changed_at,
      // No staff member means the customer did it, through their approval link.
      who: h.profiles ? name(h.profiles) : "Customer (approval link)",
      title: SYSTEM_ACTION_LABELS[h.action] ?? actionLabel.get(h.action) ?? h.action,
      detail: h.reason,
      badge: h.from_status
        ? `${JOB_STATUS_LABELS[h.from_status as JobStatus]} → ${JOB_STATUS_LABELS[h.to_status as JobStatus]}`
        : JOB_STATUS_LABELS[h.to_status as JobStatus],
      tone: "status" as const,
    })),
    ...(notes.data ?? []).map((n) => ({
      key: `n${n.id}`,
      at: n.created_at,
      who: name(n.profiles),
      title: n.visibility === "customer" ? "Note (customer can see)" : "Note",
      detail: n.body,
      tone: "note" as const,
    })),
    ...work.events.map((e) => ({
      key: `t${e.id}`,
      at: e.at,
      who: e.who,
      title: e.from ? `Task ${TASK_STATUS_LABELS[e.to].toLowerCase()}: ${e.taskTitle}` : `Task added: ${e.taskTitle}`,
      detail: e.reason,
      tone: "task" as const,
    })),
    ...(files.data ?? []).flatMap((f) => [
      {
        key: `f${f.id}`,
        at: f.uploaded_at,
        who: name(f.uploader),
        title: `Added ${ATTACHMENT_CATEGORY_LABELS[f.category as AttachmentItem["category"]].toLowerCase()}`,
        detail: f.file_name,
        tone: "file" as const,
      },
      ...(f.removed_at
        ? [{ key: `r${f.id}`, at: f.removed_at, who: name(f.remover), title: "Removed a file", detail: f.file_name, tone: "file" as const }]
        : []),
    ]),
  ].sort((a, b) => a.at.localeCompare(b.at));

  const closed = CLOSED.includes(job.status);
  const overdue = isOverdue(job.expected_delivery_at, closed, now);
  const showWork = TASK_STAGES.includes(job.status) || work.tasks.length > 0 || work.parts.length > 0;
  const holdEvent = job.status === "on_hold" ? [...(history.data ?? [])].reverse().find((h) => h.to_status === "on_hold") : null;
  const c = job.customers;
  const v = job.vehicles;
  const wa = whatsappLink(c.whatsapp ?? c.phone, `Assalam-o-Alaikum ${c.name}, update on your ${v.make} ${v.model} (${v.registration_number}) from ${ctx.workshop.workshopName}: `);

  return (
    <>
      <PageHeader
        title={job.job_number}
        description={`${v.registration_number} · ${[v.make, v.model, v.variant].filter(Boolean).join(" ")} · ${c.name}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <JobStatusBadge status={job.status} />
            {!closed ? (
              <Link href={`/jobs/${job.id}/edit`} className={buttonClass("secondary")}>
                Edit details
              </Link>
            ) : null}
          </div>
        }
      />

      {holdEvent ? (
        <div className="mb-6">
          <Alert tone="info">
            On hold since {formatDateTime(holdEvent.changed_at, tz)} (was {JOB_STATUS_LABELS[job.on_hold_from as JobStatus]}): {holdEvent.reason}
          </Alert>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-6">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Next step</h2>
            {job.status === "awaiting_inspection" ? (
              insp ? (
                <Link href={`/jobs/${job.id}/inspection`} className={buttonClass("primary", "mb-3")}>
                  Continue inspection
                </Link>
              ) : (
                <form action={startInspection} className="mb-3">
                  <input type="hidden" name="jobId" value={job.id} />
                  <button type="submit" className={buttonClass("primary")}>
                    Start inspection
                  </button>
                </form>
              )
            ) : job.status === "awaiting_estimate" && ctx.permissions.has("estimates.manage") ? (
              latestEstimate ? (
                <Link href={`/jobs/${job.id}/estimate`} className={buttonClass("primary", "mb-3")}>
                  {latestEstimate.status === "draft" ? "Continue estimate" : "Open estimate"}
                </Link>
              ) : (
                <form action={startEstimate} className="mb-3">
                  <input type="hidden" name="jobId" value={job.id} />
                  <button type="submit" className={buttonClass("primary")}>
                    Prepare estimate
                  </button>
                </form>
              )
            ) : job.status === "awaiting_approval" && ctx.permissions.has("estimates.manage") ? (
              <Link href={`/jobs/${job.id}/estimate`} className={buttonClass("primary", "mb-3")}>
                Waiting for the customer — view estimate
              </Link>
            ) : planning ? (
              <div className="mb-3 space-y-3">
                <a href="#work" className={buttonClass("primary")}>
                  Plan the work
                </a>
                <p className="text-sm text-slate-600">
                  Create tasks from the approved work and assign mechanics. The job moves to In progress when the first task
                  starts.
                </p>
              </div>
            ) : job.status === "in_progress" && openTasks > 0 ? (
              <p className="mb-3 text-sm text-slate-600">
                {openTasks} task{openTasks === 1 ? "" : "s"} still open. When every task is done or cancelled, you can move the
                job to quality check.
              </p>
            ) : null}
            <StatusActions key={job.status} jobId={job.id} status={job.status} closed={closed} actions={available} />
          </Card>

          <Card className="grid gap-4 p-6 sm:grid-cols-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Inspection</h2>
              <p className="mt-1 text-sm text-slate-600">
                {!insp
                  ? "Not started."
                  : insp.completed_at
                    ? `Completed · ${findingsCount} finding${findingsCount === 1 ? "" : "s"} to address`
                    : "In progress"}
              </p>
              {insp || !closed ? (
                <Link href={`/jobs/${job.id}/inspection`} className="mt-2 inline-block text-sm text-brand-700 hover:underline">
                  {insp ? "Open inspection" : "Start inspection"}
                </Link>
              ) : null}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Estimate</h2>
              <p className="mt-1 text-sm text-slate-600">
                {latestEstimate
                  ? `Version ${latestEstimate.version} · ${ESTIMATE_STATUS_LABELS[latestEstimate.status]} · ${formatMoney(latestEstimate.total, ctx.workshop.currency)}`
                  : "None yet."}
              </p>
              {latestEstimate && ctx.permissions.has("estimates.manage") ? (
                <Link href={`/jobs/${job.id}/estimate`} className="mt-2 inline-block text-sm text-brand-700 hover:underline">
                  Open estimate
                </Link>
              ) : null}
            </div>
          </Card>

          {showWork ? (
            <WorkPanel
              jobId={job.id}
              status={job.status}
              userId={ctx.userId}
              tasks={work.tasks}
              parts={work.parts}
              mechanics={mechanics}
              approvedParts={approvedParts}
              untaskedLines={untaskedLines}
            />
          ) : null}

          <Card className="p-6">
            <h2 className="text-sm font-semibold text-slate-900">Customer complaint</h2>
            <p className="mt-2 whitespace-pre-line text-sm text-slate-800">{job.complaint}</p>
            {job.initial_observations ? (
              <>
                <h3 className="mt-4 text-sm font-semibold text-slate-900">Initial observations</h3>
                <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{job.initial_observations}</p>
              </>
            ) : null}
            <dl className="mt-5 grid gap-x-6 gap-y-3 border-t border-slate-100 pt-4 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-slate-500">Checked in</dt>
                <dd className="text-slate-900">{formatDateTime(job.check_in_at, tz)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Odometer</dt>
                <dd className="text-slate-900">{job.check_in_mileage != null ? `${job.check_in_mileage.toLocaleString("en-PK")} km` : "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Fuel</dt>
                <dd className="text-slate-900">{job.fuel_level ? FUEL_LEVEL_LABELS[job.fuel_level] : "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Service advisor</dt>
                <dd className="text-slate-900">{job.advisor ? name(job.advisor) : "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Expected delivery</dt>
                <dd className="flex flex-wrap items-center gap-2 text-slate-900">
                  {job.expected_delivery_at ? formatDateTime(job.expected_delivery_at, tz) : "—"}
                  {overdue ? <Badge tone="warning">Overdue</Badge> : null}
                </dd>
              </div>
              {job.delivered_at || job.cancelled_at ? (
                <div>
                  <dt className="text-slate-500">{job.delivered_at ? "Delivered" : "Cancelled"}</dt>
                  <dd className="text-slate-900">{formatDateTime((job.delivered_at ?? job.cancelled_at)!, tz)}</dd>
                </div>
              ) : null}
            </dl>
          </Card>

          <Card className="p-6">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Photos and documents</h2>
            <Attachments jobId={job.id} workshopId={ctx.workshop.workshopId} items={attachments} canEdit />
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5 text-sm">
            <h2 className="font-semibold text-slate-900">Vehicle</h2>
            <Link href={`/vehicles/${v.id}`} className="mt-2 block font-medium text-brand-700 hover:underline">
              {v.registration_number}
            </Link>
            <p className="text-slate-600">
              {[v.make, v.model, v.variant, v.year].filter(Boolean).join(" ")}
              {v.colour ? ` · ${v.colour}` : ""}
            </p>
            <h2 className="mt-4 font-semibold text-slate-900">Customer</h2>
            <Link href={`/customers/${c.id}`} className="mt-2 block font-medium text-brand-700 hover:underline">
              {c.name}
            </Link>
            <p className="text-slate-600">
              {c.code} · {c.phone}
            </p>
            {wa ? (
              <a href={wa} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "mt-3 w-full")}>
                Message on WhatsApp
              </a>
            ) : null}
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Timeline</h2>
            <ol className="relative space-y-4 border-l border-slate-200 pl-4">
              {events.map((e) => (
                <li key={e.key} className="relative">
                  <span
                    aria-hidden
                    className={`absolute -left-[21px] top-1 size-2.5 rounded-full ring-2 ring-white ${
                      e.tone === "status"
                        ? "bg-brand-600"
                        : e.tone === "note"
                          ? "bg-amber-500"
                          : e.tone === "task"
                            ? "bg-emerald-500"
                            : "bg-slate-400"
                    }`}
                  />
                  <p className="text-sm font-medium text-slate-900">{e.title}</p>
                  {e.badge ? <p className="text-xs text-brand-700">{e.badge}</p> : null}
                  {e.detail ? <p className="mt-0.5 whitespace-pre-line text-sm text-slate-700">{e.detail}</p> : null}
                  <p className="mt-0.5 text-xs text-slate-500">
                    <time dateTime={e.at}>{formatDateTime(e.at, tz)}</time> · {e.who}
                  </p>
                </li>
              ))}
            </ol>
            {!closed ? (
              <div className="mt-5 border-t border-slate-100 pt-4">
                <NoteForm key={notes.data?.length ?? 0} jobId={job.id} />
              </div>
            ) : null}
          </Card>
        </div>
      </div>
    </>
  );
}
