import type { Metadata } from "next";
import Link from "next/link";
import { Badge, buttonClass, Card, PageHeader } from "@/components/ui";
import { getWorkshopContext } from "@/lib/auth/session";
import { IN_WORKSHOP, JOB_STATUS_LABELS, type JobStatus } from "@/lib/job-status";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dashboard" };

// Stages shown on the board, in workflow order.
const BOARD: JobStatus[] = [
  "awaiting_inspection",
  "awaiting_estimate",
  "awaiting_approval",
  "approved",
  "awaiting_assignment",
  "in_progress",
  "quality_check",
  "ready_for_delivery",
  "on_hold",
];

export default async function DashboardPage() {
  const ctx = await getWorkshopContext();
  const supabase = await createClient();
  const isOwner = ctx.workshop.role === "owner";
  const canJobs = ctx.permissions.has("jobs.manage");
  const wsId = ctx.workshop.workshopId;

  const [members, invites, settingsSaved, counts] = await Promise.all([
    supabase.from("workshop_members").select("id", { count: "exact", head: true }).eq("workshop_id", wsId).eq("is_active", true),
    isOwner
      ? supabase
          .from("workshop_invitations")
          .select("id", { count: "exact", head: true })
          .eq("workshop_id", wsId)
          .is("accepted_at", null)
          .is("revoked_at", null)
          .gt("expires_at", new Date().toISOString())
      : Promise.resolve({ count: 0 }),
    isOwner
      ? supabase.from("activity_logs").select("id", { count: "exact", head: true }).eq("workshop_id", wsId).eq("action", "workshop.updated")
      : Promise.resolve({ count: 0 }),
    canJobs ? supabase.rpc("job_status_counts", { ws: wsId }) : Promise.resolve({ data: [] }),
  ]);
  const teamSize = members.count ?? 1;
  const pendingInvites = invites.count ?? 0;
  const byStatus = new Map((counts.data ?? []).map((r) => [r.status, Number(r.job_count)]));
  const inWorkshop = IN_WORKSHOP.reduce((sum, s) => sum + (byStatus.get(s) ?? 0), 0);

  const steps = [
    { done: true, label: "Create your workshop", href: undefined },
    { done: teamSize > 1, label: "Invite your team", href: "/employees", note: pendingInvites ? `${pendingInvites} invite(s) pending` : undefined },
    { done: (settingsSaved.count ?? 0) > 0, label: "Review tax and numbering settings", href: "/settings" },
  ];
  const setupDone = steps.every((s) => s.done);

  return (
    <>
      <PageHeader
        title={`Welcome${ctx.fullName ? `, ${ctx.fullName.split(" ")[0]}` : ""}`}
        description={`${ctx.workshop.workshopName} · ${teamSize} active team member${teamSize === 1 ? "" : "s"}`}
      />

      <div className="mb-6 flex flex-wrap gap-3">
        {canJobs ? (
          <Link href="/jobs/new" className={buttonClass("primary")}>
            New job card
          </Link>
        ) : null}
        {ctx.permissions.has("customers.manage") ? (
          <Link href="/customers/new" className={buttonClass("secondary")}>
            New customer
          </Link>
        ) : null}
        {ctx.permissions.has("vehicles.manage") ? (
          <Link href="/vehicles" className={buttonClass("secondary")}>
            Find vehicle
          </Link>
        ) : null}
      </div>

      {canJobs ? (
        <Card className="mb-6 p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold text-slate-900">In the workshop now</h2>
            <Link href="/jobs" className="text-sm text-brand-700 hover:underline">
              {inWorkshop} vehicle{inWorkshop === 1 ? "" : "s"} · open list
            </Link>
          </div>
          <ul className="mt-4 grid gap-3 sm:grid-cols-3">
            {BOARD.map((status) => {
              const n = byStatus.get(status) ?? 0;
              return (
                <li key={status}>
                  <Link
                    href={`/jobs?status=${status}`}
                    className="block rounded-md px-4 py-3 ring-1 ring-slate-200 hover:bg-slate-50 hover:ring-slate-300"
                  >
                    <span className="block text-2xl font-semibold tabular-nums text-slate-900">{n}</span>
                    <span className="text-sm text-slate-600">{JOB_STATUS_LABELS[status]}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
          {byStatus.get("draft") ? (
            <p className="mt-3 text-sm text-slate-600">
              <Link href="/jobs?view=draft" className="text-brand-700 hover:underline">
                {byStatus.get("draft")} draft job card{byStatus.get("draft") === 1 ? "" : "s"}
              </Link>{" "}
              not checked in yet.
            </p>
          ) : null}
        </Card>
      ) : null}

      {isOwner && !setupDone ? (
        <Card className="mb-6 p-6">
          <h2 className="text-base font-semibold text-slate-900">Get your workshop ready</h2>
          <ol className="mt-4 divide-y divide-slate-100">
            {steps.map((step) => (
              <li key={step.label} className="flex items-center justify-between gap-4 py-3">
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className={`grid size-6 place-items-center rounded-full text-xs font-semibold ${step.done ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
                  >
                    {step.done ? "✓" : "•"}
                  </span>
                  <span className={`text-sm ${step.done ? "text-slate-500 line-through" : "text-slate-900"}`}>{step.label}</span>
                  {step.done ? <span className="sr-only">(done)</span> : null}
                  {step.note ? <Badge tone="warning">{step.note}</Badge> : null}
                </div>
                {!step.done && step.href ? (
                  <Link href={step.href} className={buttonClass("secondary", "py-1.5")}>
                    Open
                  </Link>
                ) : null}
              </li>
            ))}
          </ol>
        </Card>
      ) : null}

      {!canJobs ? (
        <Card className="mb-6 p-6">
          <h2 className="text-base font-semibold text-slate-900">You&apos;re all set</h2>
          <p className="mt-1 text-sm text-slate-600">Your work will appear here as the modules for your role are switched on.</p>
        </Card>
      ) : null}

      <Card className="p-6">
        <h2 className="text-base font-semibold text-slate-900">Coming next</h2>
        <p className="mt-1 text-sm text-slate-600">
          Today&apos;s invoiced amount and payments collected (shown separately), outstanding balances and low-stock alerts
          will appear here as those modules ship.
        </p>
      </Card>
    </>
  );
}
