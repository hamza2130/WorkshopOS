import type { Metadata } from "next";
import Link from "next/link";
import { JobStatusBadge } from "@/components/job-status-badge";
import { Badge, Card, cx, PageHeader } from "@/components/ui";
import { requirePageAccess } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { str } from "@/lib/params";
import { getRequestTime } from "@/lib/request-time";
import { createClient } from "@/lib/supabase/server";
import { PRIORITY_LABELS } from "@/lib/tasks";

export const metadata: Metadata = { title: "My jobs" };

export default async function MyJobsPage({ searchParams }: PageProps<"/my-jobs">) {
  const ctx = await requirePageAccess("jobs.view_assigned");
  const recent = str(await searchParams, "show") === "all";
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_assigned_jobs", { ws: ctx.workshop.workshopId, p_include_closed: recent });
  const jobs = data ?? [];
  const now = getRequestTime();
  const tz = ctx.workshop.timezone;

  return (
    <>
      <PageHeader title="My jobs" description="Vehicles with work assigned to you." />

      <nav aria-label="Filter" className="mb-4 flex gap-1.5">
        {[
          { href: "/my-jobs", label: "Current", active: !recent },
          { href: "/my-jobs?show=all", label: "Include finished", active: recent },
        ].map((f) => (
          <Link
            key={f.href}
            href={f.href}
            aria-current={f.active ? "page" : undefined}
            className={cx(
              "rounded-full px-3 py-1.5 text-sm font-medium ring-1",
              f.active ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-slate-700 ring-slate-300 hover:bg-slate-50",
            )}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {error ? (
        <Card className="p-6 text-sm text-red-700">We couldn&apos;t load your jobs. Refresh to try again.</Card>
      ) : jobs.length === 0 ? (
        <Card className="p-8 text-center text-sm text-slate-600">
          No work assigned to you right now. New tasks appear here, and you&apos;ll get a notification.
        </Card>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {jobs.map((j) => {
            const due = j.next_due_at ? new Date(j.next_due_at).getTime() : null;
            return (
              <li key={j.id}>
                <Link
                  href={`/my-jobs/${j.id}`}
                  className={cx(
                    "block h-full rounded-lg bg-white p-4 ring-1 transition hover:ring-brand-300",
                    Number(j.my_blocked_tasks) > 0 ? "ring-amber-300" : "ring-slate-200",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-lg font-semibold tracking-wide text-slate-900">{j.registration_number}</p>
                      <p className="truncate text-sm text-slate-600">
                        {[j.make, j.model, j.colour].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <JobStatusBadge status={j.status} />
                  </div>
                  {j.next_task ? (
                    <p className="mt-3 text-sm text-slate-900">
                      <span className="text-slate-500">Next:</span> {j.next_task}
                    </p>
                  ) : (
                    <p className="mt-3 text-sm text-slate-600">
                      {j.status === "cancelled" ? "Job cancelled — no work left for you." : "Your tasks here are done."}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="text-slate-500">{j.job_number}</span>
                    {Number(j.my_total_tasks) > 0 ? (
                      <Badge tone="muted">
                        {Number(j.my_open_tasks)} open of {Number(j.my_total_tasks)}
                      </Badge>
                    ) : null}
                    {Number(j.my_blocked_tasks) > 0 ? <Badge tone="warning">{Number(j.my_blocked_tasks)} blocked</Badge> : null}
                    {j.top_priority === "urgent" || j.top_priority === "high" ? (
                      <Badge tone="warning">{PRIORITY_LABELS[j.top_priority]}</Badge>
                    ) : null}
                    {due ? (
                      <span className={cx(due < now ? "font-medium text-amber-800" : "text-slate-500")}>
                        {due < now ? "Overdue · " : "Due "}
                        {formatDateTime(j.next_due_at!, tz)}
                      </span>
                    ) : null}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
