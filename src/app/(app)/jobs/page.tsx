import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { JobStatusBadge } from "@/components/job-status-badge";
import { Pagination, SearchBox } from "@/components/list-controls";
import { Badge, buttonClass, Card, cx, PageHeader } from "@/components/ui";
import { requirePageAccess } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { CLOSED, isJobStatus, JOB_STATUS_LABELS, JOB_VIEWS, type JobView } from "@/lib/job-status";
import { PAGE_SIZE, pageNumber, str, withParams } from "@/lib/params";
import { getRequestTime, isOverdue } from "@/lib/request-time";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Job cards" };

export default async function JobsPage({ searchParams }: PageProps<"/jobs">) {
  const ctx = await requirePageAccess("jobs.manage", "jobs.view_assigned");

  if (!ctx.permissions.has("jobs.manage")) redirect("/my-jobs");

  const sp = await searchParams;
  const q = str(sp, "q").slice(0, 100);
  const statusParam = str(sp, "status");
  const status = isJobStatus(statusParam) ? statusParam : null;
  const viewParam = str(sp, "view");
  const view: JobView = viewParam in JOB_VIEWS ? (viewParam as JobView) : "active";
  const page = pageNumber(sp);
  const statuses = status ? [status] : JOB_VIEWS[view].statuses;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_job_cards", {
    ws: ctx.workshop.workshopId,
    q,
    p_statuses: statuses ? [...statuses] : undefined,
    p_limit: PAGE_SIZE,
    p_offset: (page - 1) * PAGE_SIZE,
  });
  if (error) throw error;
  const total = Number(data[0]?.total_count ?? 0);
  const now = getRequestTime();

  return (
    <>
      <PageHeader
        title="Job cards"
        description="Search by job number, registration, customer name or phone."
        actions={
          <Link href="/jobs/new" className={buttonClass("primary")}>
            New job card
          </Link>
        }
      />

      <nav aria-label="Job views" className="mb-4 flex flex-wrap gap-1 border-b border-slate-200">
        {(Object.keys(JOB_VIEWS) as JobView[]).map((key) => {
          const active = !status && key === view;
          return (
            <Link
              key={key}
              href={withParams("/jobs", { view: key === "active" ? undefined : key, q })}
              aria-current={active ? "page" : undefined}
              className={cx(
                "-mb-px border-b-2 px-3 py-2 text-sm",
                active ? "border-brand-600 font-medium text-brand-900" : "border-transparent text-slate-600 hover:text-slate-900",
              )}
            >
              {JOB_VIEWS[key].label}
            </Link>
          );
        })}
        {status ? (
          <span className="-mb-px border-b-2 border-brand-600 px-3 py-2 text-sm font-medium text-brand-900">
            {JOB_STATUS_LABELS[status]}
          </span>
        ) : null}
      </nav>

      <div className="mb-4">
        <SearchBox action="/jobs" q={q} placeholder="JC-0001, LEA-1234, customer or phone" hidden={status ? { status } : view !== "active" ? { view } : {}} />
      </div>

      <Card className="overflow-hidden">
        {data.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-600">
            {q ? <>No job cards match &ldquo;{q}&rdquo;.</> : view === "active" && !status ? "No vehicles in the workshop right now." : "No job cards here."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-6 py-2.5 font-medium">Job</th>
                  <th scope="col" className="px-6 py-2.5 font-medium">Vehicle</th>
                  <th scope="col" className="hidden px-6 py-2.5 font-medium md:table-cell">Customer</th>
                  <th scope="col" className="px-6 py-2.5 font-medium">Status</th>
                  <th scope="col" className="hidden px-6 py-2.5 font-medium lg:table-cell">Checked in</th>
                  <th scope="col" className="hidden px-6 py-2.5 font-medium lg:table-cell">Expected</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((j) => {
                  const overdue = isOverdue(j.expected_delivery_at, CLOSED.includes(j.status), now);
                  return (
                    <tr key={j.id} className="hover:bg-slate-50">
                      <td className="px-6 py-3">
                        <Link href={`/jobs/${j.id}`} className="font-medium text-slate-900 hover:text-brand-700 hover:underline">
                          {j.job_number}
                        </Link>
                        <span className="block max-w-56 truncate text-xs text-slate-500">{j.complaint}</span>
                      </td>
                      <td className="px-6 py-3">
                        <span className="font-medium text-slate-800">{j.registration_number}</span>
                        <span className="block text-xs text-slate-500">
                          {j.make} {j.model}
                        </span>
                      </td>
                      <td className="hidden px-6 py-3 md:table-cell">
                        <span className="text-slate-800">{j.customer_name}</span>
                        <span className="block text-xs text-slate-500">{j.customer_phone}</span>
                      </td>
                      <td className="px-6 py-3">
                        <JobStatusBadge status={j.status} />
                      </td>
                      <td className="hidden px-6 py-3 text-slate-600 lg:table-cell">{formatDateTime(j.check_in_at, ctx.workshop.timezone)}</td>
                      <td className="hidden px-6 py-3 text-slate-600 lg:table-cell">
                        {j.expected_delivery_at ? formatDateTime(j.expected_delivery_at, ctx.workshop.timezone) : "—"}
                        {overdue ? (
                          <span className="ml-2">
                            <Badge tone="warning">Overdue</Badge>
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pagination
          path="/jobs"
          params={{ q, ...(status ? { status } : view !== "active" ? { view } : {}) }}
          page={page}
          pageSize={PAGE_SIZE}
          total={total}
        />
      </Card>
    </>
  );
}
