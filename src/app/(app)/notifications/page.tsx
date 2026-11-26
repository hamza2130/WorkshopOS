import type { Metadata } from "next";
import { Card, cx, PageHeader } from "@/components/ui";
import { getWorkshopContext } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { markAllRead, openNotification } from "./actions";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const ctx = await getWorkshopContext();
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, title, body, link, created_at, read_at")
    .eq("workshop_id", ctx.workshop.workshopId)
    .order("created_at", { ascending: false })
    .limit(100);
  const unread = (data ?? []).filter((n) => !n.read_at).length;

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Updates on your jobs and tasks: estimate decisions, new and blocked work, finished, paid and cancelled jobs."
        actions={
          unread ? (
            <form action={markAllRead}>
              <button type="submit" className="rounded-md px-3 py-2 text-sm text-brand-700 hover:bg-brand-50">
                Mark all as read
              </button>
            </form>
          ) : null
        }
      />
      <Card className="overflow-hidden">
        {data?.length ? (
          <ul className="divide-y divide-slate-100">
            {data.map((n) => (
              <li key={n.id}>
                <form action={openNotification}>
                  <input type="hidden" name="id" value={n.id} />
                  <input type="hidden" name="link" value={n.link ?? "/dashboard"} />
                  <button type="submit" className={cx("flex w-full items-start gap-3 px-6 py-3 text-left hover:bg-slate-50", !n.read_at && "bg-brand-50/50")}>
                    <span aria-hidden className={cx("mt-1.5 size-2 shrink-0 rounded-full", n.read_at ? "bg-transparent" : "bg-brand-600")} />
                    <span className="min-w-0 flex-1">
                      <span className={cx("block text-sm", n.read_at ? "text-slate-700" : "font-medium text-slate-900")}>
                        {n.title}
                        {!n.read_at ? <span className="sr-only"> (unread)</span> : null}
                      </span>
                      {n.body ? <span className="block text-sm text-slate-600">{n.body}</span> : null}
                      <span className="block text-xs text-slate-500">{formatDateTime(n.created_at, ctx.workshop.timezone)}</span>
                    </span>
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-8 text-center text-sm text-slate-600">No notifications yet.</p>
        )}
      </Card>
    </>
  );
}
