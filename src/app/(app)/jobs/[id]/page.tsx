import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JobStatusBadge } from "@/components/job-status-badge";
import { Alert, Badge, buttonClass, Card, PageHeader } from "@/components/ui";
import { requirePageAccess } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { ATTACHMENT_CATEGORY_LABELS } from "@/lib/job-schema";
import { CLOSED, FUEL_LEVEL_LABELS, JOB_STATUS_LABELS, SYSTEM_ACTION_LABELS, type JobStatus } from "@/lib/job-status";
import { isUuid } from "@/lib/params";
import { whatsappLink } from "@/lib/phone";
import { getRequestTime, isOverdue } from "@/lib/request-time";
import { createClient } from "@/lib/supabase/server";
import { Attachments, type AttachmentItem } from "./attachments";
import { NoteForm } from "./note-form";
import { StatusActions } from "./status-actions";

export const metadata: Metadata = { title: "Job card" };

type TimelineEvent = {
  key: string;
  at: string;
  who: string;
  title: string;
  detail?: string | null;
  badge?: string;
  tone?: "status" | "note" | "file";
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

  const [history, notes, files, actions] = await Promise.all([
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
    supabase.from("job_status_actions").select("code, label, from_status, requires_reason, tone, sort_order").order("sort_order"),
  ]);

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
  const available = (actions.data ?? [])
    .filter((a) => a.from_status === job.status)
    .map((a) => ({ code: a.code, label: a.label, requiresReason: a.requires_reason, tone: a.tone }));

  const events: TimelineEvent[] = [
    ...(history.data ?? []).map((h) => ({
      key: `h${h.id}`,
      at: h.changed_at,
      who: name(h.profiles),
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
  const overdue = isOverdue(job.expected_delivery_at, closed, getRequestTime());
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
            <StatusActions key={job.status} jobId={job.id} status={job.status} actions={available} />
          </Card>

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
                      e.tone === "status" ? "bg-brand-600" : e.tone === "note" ? "bg-amber-500" : "bg-slate-400"
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
