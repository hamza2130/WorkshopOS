import type { Metadata } from "next";
import Link from "next/link";
import { Badge, buttonClass, Card, PageHeader } from "@/components/ui";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { requirePageAccess } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { InviteForm } from "./invite-form";
import { ManageMember, RevokeInvite } from "./member-controls";

export const metadata: Metadata = { title: "Employees" };

export default async function EmployeesPage() {
  const ctx = await requirePageAccess("staff.manage");
  const supabase = await createClient();
  const wsId = ctx.workshop.workshopId;
  const tz = ctx.workshop.timezone;

  const [members, invites] = await Promise.all([
    supabase
      .from("workshop_members")
      .select("id, user_id, role, is_active, extra_permissions, created_at, profiles(full_name, email, phone)")
      .eq("workshop_id", wsId)
      .order("is_active", { ascending: false })
      .order("created_at"),
    supabase
      .from("workshop_invitations")
      .select("id, email, role, expires_at, created_at")
      .eq("workshop_id", wsId)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false }),
  ]);
  if (members.error) throw members.error;
  if (invites.error) throw invites.error;

  return (
    <>
      <PageHeader
        title="Employees"
        description="Invite your team and decide what each person can do."
        actions={
          <Link href="/activity" className={buttonClass("secondary")}>
            Activity log
          </Link>
        }
      />

      <Card className="p-6">
        <h2 className="text-base font-semibold text-slate-900">Invite an employee</h2>
        <p className="mb-4 mt-1 text-sm text-slate-600">
          You&apos;ll get a one-time link to send them, by WhatsApp or any other way. They sign up with the same email.
        </p>
        <InviteForm workshopName={ctx.workshop.workshopName} />
      </Card>

      {invites.data.length > 0 ? (
        <Card className="mt-6 overflow-hidden">
          <h2 className="border-b border-slate-200 px-6 py-3 text-sm font-semibold text-slate-900">Pending invites</h2>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-6 py-2 font-medium">Email</th>
                <th scope="col" className="px-6 py-2 font-medium">Role</th>
                <th scope="col" className="hidden px-6 py-2 font-medium sm:table-cell">Expires</th>
                <th scope="col" className="px-6 py-2"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invites.data.map((i) => (
                <tr key={i.id}>
                  <td className="px-6 py-3 text-slate-900">{i.email}</td>
                  <td className="px-6 py-3 text-slate-700">{ROLE_LABELS[i.role]}</td>
                  <td className="hidden px-6 py-3 text-slate-600 sm:table-cell">{formatDate(i.expires_at, tz)}</td>
                  <td className="px-6 py-2">
                    <RevokeInvite invitationId={i.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}

      <Card className="mt-6 overflow-hidden">
        <h2 className="border-b border-slate-200 px-6 py-3 text-sm font-semibold text-slate-900">Team</h2>
        <ul className="divide-y divide-slate-100">
          {members.data.map((m) => {
            const isSelf = m.user_id === ctx.userId;
            return (
              <li key={m.id} className="flex flex-wrap items-start justify-between gap-3 px-6 py-4">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-900">
                    {m.profiles?.full_name || m.profiles?.email}
                    {isSelf ? <Badge tone="muted">You</Badge> : null}
                    {!m.is_active ? <Badge tone="warning">Deactivated</Badge> : null}
                  </p>
                  <p className="mt-0.5 text-sm text-slate-600">
                    {m.profiles?.email}
                    {m.profiles?.phone ? ` · ${m.profiles.phone}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {ROLE_LABELS[m.role]}
                    {m.extra_permissions.length ? ` + ${m.extra_permissions.length} extra permission(s)` : ""} · joined{" "}
                    {formatDate(m.created_at, tz)}
                  </p>
                </div>
                {isSelf ? null : (
                  <div className="w-full sm:w-auto sm:max-w-md">
                    <ManageMember memberId={m.id} role={m.role} extraPermissions={m.extra_permissions} isActive={m.is_active} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    </>
  );
}
