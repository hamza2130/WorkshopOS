import type { Metadata } from "next";
import { Alert, Badge, Card } from "@/components/ui";
import { getUser } from "@/lib/auth/session";
import { CATEGORY_LABELS, OUTCOME_LABELS } from "@/lib/estimates";
import { formatDateTime } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { ApprovalForm } from "./approval-form";
import type { CustomerEstimate } from "./types";

export const metadata: Metadata = {
  title: "Your repair estimate",
  robots: { index: false, follow: false },
};

const METHOD: Record<string, string> = { link: "online", in_person: "in person", phone: "by phone", whatsapp: "on WhatsApp" };

export default async function ApprovePage({ params }: PageProps<"/approve/[token]">) {
  const { token } = await params;
  const supabase = await createClient();
  const staff = await getUser();
  const { data: raw } = /^[0-9a-f]{64}$/.test(token)
    ? await supabase.rpc("get_estimate_for_customer", { p_token: token })
    : { data: null };
  const data = raw as CustomerEstimate | null;

  if (!data) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-12">
        <Card className="p-6">
          <h1 className="text-lg font-semibold text-slate-900">This link isn&apos;t valid</h1>
          <p className="mt-2 text-sm text-slate-600">
            It may have been replaced by a newer estimate. Please ask the workshop to send you the latest link.
          </p>
        </Card>
      </main>
    );
  }

  const e = data.estimate;
  const cur = data.workshop.currency;
  const tz = data.workshop.timezone;
  const open = e.status === "sent" && !e.expired;
  const approvedIds = new Set(data.items.filter((i) => i.approval_status === "approved").map((i) => i.id));

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <header className="mb-6">
        <p className="text-sm font-semibold text-brand-700">{data.workshop.name}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Your repair estimate</h1>
        <p className="mt-1 text-sm text-slate-600">
          {data.vehicle.make} {data.vehicle.model} · {data.vehicle.registration} · job {data.job_number}
          {e.version > 1 ? ` · updated estimate (version ${e.version})` : ""}
        </p>
      </header>

      <div className="space-y-5">
        <Card className="p-5 text-sm">
          <p className="text-slate-800">
            Assalam-o-Alaikum {data.customer_first_name}. You told us: <span className="italic">“{data.complaint}”</span>
          </p>
          {e.customer_note ? <p className="mt-3 whitespace-pre-line text-slate-800">{e.customer_note}</p> : null}
          {e.estimated_completion ? <p className="mt-3 text-slate-600">Estimated completion: {e.estimated_completion}</p> : null}
        </Card>

        {data.findings.length ? (
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-slate-900">What we found during inspection</h2>
            <ul className="mt-2 space-y-1.5 text-sm">
              {data.findings.map((f) => (
                <li key={f.category} className="flex flex-wrap items-baseline gap-2">
                  <Badge tone="warning">{OUTCOME_LABELS[f.outcome]}</Badge>
                  <span className="font-medium text-slate-900">{CATEGORY_LABELS[f.category]}</span>
                  {f.notes ? <span className="text-slate-600">— {f.notes}</span> : null}
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        {open && staff ? (
          <Alert>
            You&apos;re signed in as {staff.email}. A decision made here is recorded under your name. To record what the customer
            told you in person or by phone, use “Record the customer&apos;s decision” on the estimate page instead.
          </Alert>
        ) : null}

        {open ? (
          <ApprovalForm token={token} data={data} />
        ) : (
          <>
            {e.status === "sent" && e.expired ? (
              <Alert>This estimate&apos;s link expired on {formatDateTime(e.expires_at, tz)}. Please ask the workshop for a new one.</Alert>
            ) : data.decision ? (
              <Alert tone="success">
                Thank you{data.decision.customer_name ? `, ${data.decision.customer_name}` : ""}. Your decision was recorded{" "}
                {METHOD[data.decision.method] ?? ""} on {formatDateTime(data.decision.decided_at, tz)}.
                {Number(data.decision.approved_total) ? ` Approved work: ${formatMoney(data.decision.approved_total, cur)}.` : " You declined the work."}
              </Alert>
            ) : null}
            <Card className="overflow-hidden">
              <ul className="divide-y divide-slate-100">
                {data.items.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                    <span className={approvedIds.has(i.id) ? "text-slate-900" : "text-slate-400 line-through"}>{i.description}</span>
                    <span className="flex items-center gap-2">
                      <span className="tabular-nums">{formatMoney(i.line_total, cur)}</span>
                      {i.approval_status !== "pending" ? (
                        <Badge tone={i.approval_status === "approved" ? "success" : "muted"}>
                          {i.approval_status === "approved" ? "Approved" : "Declined"}
                        </Badge>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </>
        )}

        <Card className="p-5 text-sm">
          <dl className="space-y-1">
            <div className="flex justify-between text-slate-600">
              <dt>All work listed</dt>
              <dd className="tabular-nums">{formatMoney(Number(e.subtotal) - Number(e.discount_total), cur)}</dd>
            </div>
            {Number(e.tax_rate) ? (
              <div className="flex justify-between text-slate-600">
                <dt>
                  {e.tax_label} ({Number(e.tax_rate)}%)
                </dt>
                <dd className="tabular-nums">{formatMoney(e.tax_total, cur)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between font-semibold text-slate-900">
              <dt>Total if everything is approved</dt>
              <dd className="tabular-nums">{formatMoney(e.total, cur)}</dd>
            </div>
          </dl>
          {e.terms ? <p className="mt-4 whitespace-pre-line border-t border-slate-100 pt-3 text-xs text-slate-500">{e.terms}</p> : null}
          {open ? (
            <p className="mt-3 text-xs text-slate-500">This estimate is valid until {formatDateTime(e.expires_at, tz)}.</p>
          ) : null}
        </Card>
      </div>
    </main>
  );
}
