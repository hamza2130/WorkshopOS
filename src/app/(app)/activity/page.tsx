import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/ui";
import { ROLE_LABELS, type Role } from "@/lib/auth/permissions";
import { requirePageAccess } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Activity" };

type Meta = { email?: string; role?: Role; from?: Role; to?: Role };

function describe(action: string, meta: Meta, subject: string) {
  switch (action) {
    case "workshop.created":
      return "created the workshop";
    case "workshop.updated":
      return "updated workshop settings";
    case "member.invited":
      return `invited ${meta.email} as ${meta.role ? ROLE_LABELS[meta.role] : "a member"}`;
    case "member.joined":
      return `joined as ${meta.role ? ROLE_LABELS[meta.role] : "a member"}`;
    case "member.role_changed":
      return `changed ${subject}'s role from ${meta.from ? ROLE_LABELS[meta.from] : "?"} to ${meta.to ? ROLE_LABELS[meta.to] : "?"}`;
    case "member.permissions_changed":
      return `changed ${subject}'s extra permissions`;
    case "member.deactivated":
      return `deactivated ${subject}`;
    case "member.activated":
      return `reactivated ${subject}`;
    default:
      return action;
  }
}

export default async function ActivityPage() {
  const ctx = await requirePageAccess("activity.view");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activity_logs")
    .select("id, action, metadata, created_at, actor:profiles(full_name, email)")
    .eq("workshop_id", ctx.workshop.workshopId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;

  const subjectIds = [...new Set(data.map((e) => (e.metadata as { user_id?: string }).user_id).filter(Boolean))] as string[];
  const { data: subjects } = subjectIds.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", subjectIds)
    : { data: [] };
  const nameOf = new Map((subjects ?? []).map((p) => [p.id, p.full_name || p.email]));

  return (
    <>
      <PageHeader title="Activity" description="Every significant change in your workshop, newest first." />
      <Card className="overflow-hidden">
        {data.length === 0 ? (
          <p className="p-6 text-sm text-slate-600">No activity yet.</p>
        ) : (
          <ol className="divide-y divide-slate-100">
            {data.map((e) => {
              const meta = e.metadata as Meta & { user_id?: string };
              const subject = (meta.user_id && nameOf.get(meta.user_id)) || "a member";
              return (
                <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-2 px-6 py-3 text-sm">
                  <p className="text-slate-800">
                    <span className="font-medium text-slate-900">{e.actor?.full_name || e.actor?.email || "System"}</span>{" "}
                    {describe(e.action, meta, subject)}
                  </p>
                  <time dateTime={e.created_at} className="text-xs text-slate-500">
                    {formatDateTime(e.created_at, ctx.workshop.timezone)}
                  </time>
                </li>
              );
            })}
          </ol>
        )}
      </Card>
    </>
  );
}
