import type { Metadata } from "next";
import Link from "next/link";
import { Badge, buttonClass, Card, PageHeader } from "@/components/ui";
import { getWorkshopContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const ctx = await getWorkshopContext();
  const supabase = await createClient();
  const isOwner = ctx.workshop.role === "owner";
  const wsId = ctx.workshop.workshopId;

  const [members, invites, settingsSaved] = await Promise.all([
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
      ? supabase
          .from("activity_logs")
          .select("id", { count: "exact", head: true })
          .eq("workshop_id", wsId)
          .eq("action", "workshop.updated")
      : Promise.resolve({ count: 0 }),
  ]);
  const teamSize = members.count ?? 1;
  const pendingInvites = invites.count ?? 0;

  const steps = [
    { done: true, label: "Create your workshop", href: undefined },
    { done: teamSize > 1, label: "Invite your team", href: "/employees", note: pendingInvites ? `${pendingInvites} invite(s) pending` : undefined },
    { done: (settingsSaved.count ?? 0) > 0, label: "Review tax and numbering settings", href: "/settings" },
  ];

  return (
    <>
      <PageHeader
        title={`Welcome${ctx.fullName ? `, ${ctx.fullName.split(" ")[0]}` : ""}`}
        description={`${ctx.workshop.workshopName} · ${teamSize} active team member${teamSize === 1 ? "" : "s"}`}
      />

      {ctx.permissions.has("customers.manage") || ctx.permissions.has("vehicles.manage") ? (
        <div className="mb-6 flex flex-wrap gap-3">
          {ctx.permissions.has("customers.manage") ? (
            <>
              <Link href="/customers/new" className={buttonClass("primary")}>
                New customer
              </Link>
              <Link href="/customers" className={buttonClass("secondary")}>
                Find customer
              </Link>
            </>
          ) : null}
          {ctx.permissions.has("vehicles.manage") ? (
            <>
              <Link href="/vehicles/new" className={buttonClass("secondary")}>
                Add vehicle
              </Link>
              <Link href="/vehicles" className={buttonClass("secondary")}>
                Find vehicle
              </Link>
            </>
          ) : null}
        </div>
      ) : null}

      {isOwner ? (
        <Card className="p-6">
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
      ) : (
        <Card className="p-6">
          <h2 className="text-base font-semibold text-slate-900">You&apos;re all set</h2>
          <p className="mt-1 text-sm text-slate-600">
            Job cards, customers and vehicles are being added next. You&apos;ll see your work here as soon as they arrive.
          </p>
        </Card>
      )}

      <Card className="mt-6 p-6">
        <h2 className="text-base font-semibold text-slate-900">Coming next</h2>
        <p className="mt-1 text-sm text-slate-600">
          Live job counts, today&apos;s invoiced amount and payments collected (shown separately), outstanding balances
          and low-stock alerts will appear here as each module ships.
        </p>
      </Card>
    </>
  );
}
