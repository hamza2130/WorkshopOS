import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge, buttonClass, Card, PageHeader } from "@/components/ui";
import type { Permission } from "@/lib/auth/permissions";
import { getWorkshopContext } from "@/lib/auth/session";
import { utcToZonedLocal, zonedLocalToUtc } from "@/lib/datetime";
import { IN_WORKSHOP, JOB_STATUS_LABELS, type JobStatus } from "@/lib/job-status";
import { formatQty } from "@/lib/inventory";
import { formatMoney } from "@/lib/money";
import { getRequestTime } from "@/lib/request-time";
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
  // Mechanics start on their own job list.
  if (!ctx.permissions.has("dashboard.view") && ctx.permissions.has("jobs.view_assigned")) redirect("/my-jobs");
  const supabase = await createClient();
  const isOwner = ctx.workshop.role === "owner";
  const canJobs = ctx.permissions.has("jobs.manage");
  const canBilling = ["invoices.manage", "payments.record", "reports.financial"].some((p) => ctx.permissions.has(p as Permission));
  const canStock = ctx.permissions.has("inventory.manage");
  const wsId = ctx.workshop.workshopId;
  // "Today" in the workshop's time zone, not the server's.
  const today = utcToZonedLocal(new Date(getRequestTime()), ctx.workshop.timezone).slice(0, 10);
  const dayStart = zonedLocalToUtc(`${today}T00:00`, ctx.workshop.timezone)!;
  const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000);

  const [members, invites, settingsSaved, counts, billing, lowStock, outOfStock] = await Promise.all([
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
    canBilling
      ? supabase.rpc("billing_summary", { ws: wsId, p_from: dayStart.toISOString(), p_to: dayEnd.toISOString() })
      : Promise.resolve({ data: [] }),
    canStock ? supabase.rpc("low_stock_parts", { ws: wsId }) : Promise.resolve({ data: [] }),
    // Parts with no reorder level still count once they run out.
    canStock
      ? supabase
          .from("parts")
          .select("id, name, part_number, unit, stock_on_hand, reorder_level")
          .eq("workshop_id", wsId)
          .eq("is_active", true)
          .eq("track_stock", true)
          .lte("stock_on_hand", 0)
          .limit(50)
      : Promise.resolve({ data: [] }),
  ]);
  const shortParts = [...new Map([...(lowStock.data ?? []), ...(outOfStock.data ?? [])].map((p) => [p.id, p])).values()].sort(
    (a, b) => Number(a.stock_on_hand) - Number(b.stock_on_hand),
  );
  const b = billing.data?.[0];
  const cur = ctx.workshop.currency;
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
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {BOARD.map((status) => {
              const n = byStatus.get(status) ?? 0;
              return (
                <li key={status}>
                  <Link
                    href={`/jobs?status=${status}`}
                    className="block rounded-md px-4 py-3 ring-1 ring-slate-200 hover:bg-slate-50 hover:ring-slate-300"
                  >
                    {/* Empty stages are dimmed so the busy ones stand out. */}
                    <span className={`block text-2xl font-semibold tabular-nums ${n ? "text-slate-900" : "text-slate-300"}`}>{n}</span>
                    <span className={`text-sm ${n ? "text-slate-700" : "text-slate-400"}`}>{JOB_STATUS_LABELS[status]}</span>
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

      {canBilling && b ? (
        <Card className="mb-6 p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold text-slate-900">Money today</h2>
            <Link href="/invoices" className="text-sm text-brand-700 hover:underline">
              Invoices
            </Link>
          </div>
          {/* Invoiced and collected are different numbers and are never added together (PRD). */}
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-md px-4 py-3 ring-1 ring-slate-200">
              <p className="text-sm text-slate-600">Invoiced today</p>
              <p className="text-2xl font-semibold tabular-nums text-slate-900">{formatMoney(b.invoiced, cur)}</p>
              <p className="text-xs text-slate-500">
                {b.invoice_count} invoice{Number(b.invoice_count) === 1 ? "" : "s"} issued
              </p>
            </div>
            <div className="rounded-md px-4 py-3 ring-1 ring-slate-200">
              <p className="text-sm text-slate-600">Collected today</p>
              <p className="text-2xl font-semibold tabular-nums text-slate-900">{formatMoney(b.collected, cur)}</p>
              <p className="text-xs text-slate-500">Payments received, less refunds</p>
            </div>
            <Link href="/invoices" className="block rounded-md px-4 py-3 ring-1 ring-slate-200 hover:bg-slate-50 hover:ring-slate-300">
              <p className="text-sm text-slate-600">Outstanding</p>
              <p className={`text-2xl font-semibold tabular-nums ${Number(b.outstanding) > 0 ? "text-amber-800" : "text-slate-900"}`}>
                {formatMoney(b.outstanding, cur)}
              </p>
              <p className="text-xs text-slate-500">
                On {b.unpaid_count} unpaid invoice{Number(b.unpaid_count) === 1 ? "" : "s"}, all dates
              </p>
            </Link>
          </div>
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

      {!canJobs && !canBilling && !canStock ? (
        <Card className="mb-6 p-6">
          <h2 className="text-base font-semibold text-slate-900">You&apos;re all set</h2>
          <p className="mt-1 text-sm text-slate-600">Your work will appear here as the modules for your role are switched on.</p>
        </Card>
      ) : null}

      {canStock ? (
        <Card className="mb-6 p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold text-slate-900">Stock to reorder</h2>
            <Link href="/inventory?view=low" className="text-sm text-brand-700 hover:underline">
              {shortParts.length ? `${shortParts.length} part${shortParts.length === 1 ? "" : "s"} · open list` : "Inventory"}
            </Link>
          </div>
          {shortParts.length ? (
            <ul className="mt-3 divide-y divide-slate-100">
              {shortParts.slice(0, 6).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <Link href={`/inventory/${p.id}`} className="font-medium text-slate-900 hover:text-brand-700 hover:underline">
                    {p.name}
                  </Link>
                  <span className={`tabular-nums ${Number(p.stock_on_hand) <= 0 ? "font-medium text-red-700" : "text-amber-800"}`}>
                    {formatQty(p.stock_on_hand)} {p.unit} left
                    {p.reorder_level != null ? ` · reorder at ${formatQty(p.reorder_level)}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-slate-600">Nothing is low. Set reorder levels on parts to be warned before they run out.</p>
          )}
        </Card>
      ) : null}
    </>
  );
}
