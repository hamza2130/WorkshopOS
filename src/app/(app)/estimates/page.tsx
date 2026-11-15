import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, cx, PageHeader } from "@/components/ui";
import { requirePageAccess } from "@/lib/auth/session";
import { ESTIMATE_STATUS_LABELS, ESTIMATE_STATUS_TONES, type EstimateStatus } from "@/lib/estimates";
import { formatDateTime } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { str } from "@/lib/params";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Estimates" };

const VIEWS: Record<string, { label: string; statuses: EstimateStatus[] }> = {
  waiting: { label: "Waiting for customer", statuses: ["sent"] },
  draft: { label: "Drafts", statuses: ["draft"] },
  decided: { label: "Decided", statuses: ["approved", "partially_approved", "rejected"] },
};

export default async function EstimatesPage({ searchParams }: PageProps<"/estimates">) {
  const ctx = await requirePageAccess("estimates.manage");
  const view = str(await searchParams, "view");
  const current = view in VIEWS ? view : "waiting";
  const supabase = await createClient();
  const { data } = await supabase
    .from("estimates")
    .select("id, version, status, total, sent_at, decided_at, updated_at, approval_expires_at, job_cards(id, job_number, vehicles(registration_number), customers(name))")
    .eq("workshop_id", ctx.workshop.workshopId)
    .in("status", VIEWS[current].statuses)
    .order("updated_at", { ascending: false })
    .limit(100);
  const tz = ctx.workshop.timezone;

  return (
    <>
      <PageHeader title="Estimates" description="Estimates are created from a job card once the inspection is done." />
      <nav aria-label="Estimate views" className="mb-4 flex flex-wrap gap-1 border-b border-slate-200">
        {Object.entries(VIEWS).map(([key, v]) => (
          <Link
            key={key}
            href={key === "waiting" ? "/estimates" : `/estimates?view=${key}`}
            aria-current={key === current ? "page" : undefined}
            className={cx(
              "-mb-px border-b-2 px-3 py-2 text-sm",
              key === current ? "border-brand-600 font-medium text-brand-900" : "border-transparent text-slate-600 hover:text-slate-900",
            )}
          >
            {v.label}
          </Link>
        ))}
      </nav>
      <Card className="overflow-hidden">
        {data?.length ? (
          <ul className="divide-y divide-slate-100">
            {data.map((e) => (
              <li key={e.id}>
                <Link href={`/jobs/${e.job_cards?.id}/estimate?v=${e.version}`} className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 hover:bg-slate-50">
                  <span className="text-sm">
                    <span className="font-medium text-slate-900">{e.job_cards?.job_number}</span>
                    <span className="ml-2 text-slate-600">
                      v{e.version} · {e.job_cards?.vehicles?.registration_number} · {e.job_cards?.customers?.name}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {e.status === "sent" && e.sent_at
                        ? `Sent ${formatDateTime(e.sent_at, tz)} · expires ${formatDateTime(e.approval_expires_at!, tz)}`
                        : e.decided_at
                          ? `Decided ${formatDateTime(e.decided_at, tz)}`
                          : `Last changed ${formatDateTime(e.updated_at, tz)}`}
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="text-sm font-medium tabular-nums text-slate-900">{formatMoney(e.total, ctx.workshop.currency)}</span>
                    <Badge tone={ESTIMATE_STATUS_TONES[e.status]}>{ESTIMATE_STATUS_LABELS[e.status]}</Badge>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-8 text-center text-sm text-slate-600">Nothing here.</p>
        )}
      </Card>
    </>
  );
}
