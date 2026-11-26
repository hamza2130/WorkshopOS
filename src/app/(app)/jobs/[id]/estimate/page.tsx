import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, Badge, buttonClass, Card, cx, PageHeader } from "@/components/ui";
import { requirePageAccess } from "@/lib/auth/session";
import {
  APPROVAL_LABELS,
  CATEGORY_LABELS,
  ESTIMATE_STATUS_LABELS,
  ESTIMATE_STATUS_TONES,
  KIND_LABELS,
  METHOD_LABELS,
  OUTCOME_LABELS,
  SOURCE_LABELS,
} from "@/lib/estimates";
import { formatDateTime } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { isUuid, str } from "@/lib/params";
import { createClient } from "@/lib/supabase/server";
import { addFindingLine } from "./actions";
import { AddLineForm, DecisionForm, DetailsForm, LineEditor, ReviseForm, SharePanel } from "./estimate-forms";

export const metadata: Metadata = { title: "Estimate" };

const REVISABLE = ["awaiting_estimate", "awaiting_approval", "approved", "awaiting_assignment"];

export default async function EstimatePage({ params, searchParams }: PageProps<"/jobs/[id]/estimate">) {
  const ctx = await requirePageAccess("estimates.manage");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const sp = await searchParams;
  const tz = ctx.workshop.timezone;
  const cur = ctx.workshop.currency;
  const supabase = await createClient();

  const { data: job } = await supabase
    .from("job_cards")
    .select("id, job_number, status, complaint, customers(name, phone, whatsapp), vehicles(registration_number, make, model)")
    .eq("id", id)
    .eq("workshop_id", ctx.workshop.workshopId)
    .maybeSingle();
  if (!job || !job.customers || !job.vehicles) notFound();

  const [{ data: versions }, { data: inspection }] = await Promise.all([
    supabase.from("estimates").select("*").eq("job_card_id", id).order("version", { ascending: false }),
    supabase
      .from("job_inspections")
      .select("completed_at, job_inspection_items(category, outcome, notes)")
      .eq("job_card_id", id)
      .maybeSingle(),
  ]);

  const wanted = Number(str(sp, "v"));
  const est = versions?.find((v) => v.version === wanted) ?? versions?.[0];
  const [{ data: lines }, { data: decisions }, catalogue] = await Promise.all([
    est
      ? supabase.from("estimate_items").select("*").eq("estimate_id", est.id).order("position").order("created_at")
      : Promise.resolve({ data: [] }),
    est
      ? supabase
          .from("estimate_decisions")
          .select("decision, method, customer_name, note, approved_total, decided_at, recorder:profiles(full_name, email)")
          .eq("estimate_id", est.id)
          .order("decided_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    est?.status === "draft"
      ? Promise.all([
          supabase.from("labour_items").select("id, name, default_price, estimated_minutes").eq("workshop_id", ctx.workshop.workshopId).eq("is_active", true).order("name"),
          supabase.from("parts").select("id, name, selling_price, brand, part_number, unit").eq("workshop_id", ctx.workshop.workshopId).eq("is_active", true).order("name"),
        ])
      : Promise.resolve(null),
  ]);

  const v = job.vehicles;
  const c = job.customers;
  const share = {
    jobId: job.id,
    customerName: c.name,
    phone: c.whatsapp ?? c.phone,
    vehicle: `${v.make} ${v.model} (${v.registration_number})`,
    workshop: ctx.workshop.workshopName,
  };
  const findings = (inspection?.completed_at ? inspection.job_inspection_items : []).filter(
    (f) => f.outcome === "needs_attention" || f.outcome === "requires_repair",
  );
  const onEstimate = new Set((lines ?? []).map((l) => l.inspection_category).filter(Boolean));
  const decision = decisions?.[0];
  const isLatest = est && versions?.[0]?.id === est.id;
  const canRevise = isLatest && est.status !== "draft" && REVISABLE.includes(job.status);
  const needsReason = job.status !== "awaiting_estimate";

  return (
    <>
      <PageHeader
        title={`Estimate · ${job.job_number}`}
        description={`${v.registration_number} · ${v.make} ${v.model} · ${c.name}`}
        actions={
          <Link href={`/jobs/${job.id}`} className={buttonClass("secondary")}>
            Back to job card
          </Link>
        }
      />

      {!est ? (
        <Card className="max-w-xl p-6">
          {job.status === "awaiting_estimate" ? (
            <>
              <p className="mb-4 text-sm text-slate-700">
                Build the estimate from your saved services and parts, and add the inspection&apos;s recommendations.
              </p>
              <ReviseForm jobId={job.id} needsReason={false} label="Start estimate" />
            </>
          ) : (
            <p className="text-sm text-slate-700">
              {job.status === "awaiting_inspection"
                ? "Complete or skip the inspection first, then prepare the estimate."
                : "This job isn't at the estimate stage."}
            </p>
          )}
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          <div className="min-w-0 space-y-6">
            <Card className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-6 py-3">
                <h2 className="text-sm font-semibold text-slate-900">
                  Version {est.version}{" "}
                  <span className="ml-1">
                    <Badge tone={ESTIMATE_STATUS_TONES[est.status]}>{ESTIMATE_STATUS_LABELS[est.status]}</Badge>
                  </span>
                </h2>
                {est.sent_at ? (
                  <span className="text-xs text-slate-500">
                    Sent {formatDateTime(est.sent_at, tz)}
                    {est.status === "sent" && est.approval_expires_at ? ` · link expires ${formatDateTime(est.approval_expires_at, tz)}` : ""}
                  </span>
                ) : null}
              </div>

              {lines?.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        {/* Keeps descriptions readable; on narrow screens the table scrolls instead. */}
                        <th scope="col" className="min-w-52 px-6 py-2 font-medium">Line</th>
                        <th scope="col" className="px-3 py-2 text-right font-medium">Qty</th>
                        <th scope="col" className="px-3 py-2 text-right font-medium">Price</th>
                        <th scope="col" className="px-3 py-2 text-right font-medium">Discount</th>
                        <th scope="col" className="px-3 py-2 text-right font-medium">Total</th>
                        <th scope="col" className="px-6 py-2">
                          <span className="sr-only">{est.status === "draft" ? "Actions" : "Customer"}</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {lines.map((l) => (
                        <tr key={l.id} className={cx(l.approval_status === "declined" && "text-slate-400")}>
                          <td className="px-6 py-3">
                            <span className={cx("font-medium", l.approval_status === "declined" ? "line-through" : "text-slate-900")}>{l.description}</span>
                            <span className="block text-xs text-slate-500">
                              {KIND_LABELS[l.kind]} · {SOURCE_LABELS[l.source]}
                              {l.inspection_category ? ` · ${CATEGORY_LABELS[l.inspection_category]}` : ""}
                              {!l.taxable ? " · not taxed" : ""}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums">{Number(l.quantity)}</td>
                          <td className="px-3 py-3 text-right tabular-nums">{formatMoney(l.unit_price, cur)}</td>
                          <td className="px-3 py-3 text-right tabular-nums">{Number(l.discount) ? `−${formatMoney(l.discount, cur)}` : "—"}</td>
                          <td className="px-3 py-3 text-right font-medium tabular-nums">{formatMoney(l.line_total, cur)}</td>
                          <td className="relative px-6 py-3 text-right">
                            {est.status === "draft" ? (
                              <LineEditor
                                lineId={l.id}
                                jobId={job.id}
                                defaults={{
                                  description: l.description,
                                  quantity: String(Number(l.quantity)),
                                  unitPrice: String(Number(l.unit_price)),
                                  discount: Number(l.discount) ? String(Number(l.discount)) : "",
                                  taxable: l.taxable,
                                }}
                              />
                            ) : (
                              <Badge tone={l.approval_status === "approved" ? "success" : l.approval_status === "declined" ? "muted" : "warning"}>
                                {APPROVAL_LABELS[l.approval_status]}
                              </Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="px-6 py-5 text-sm text-slate-600">No lines yet.</p>
              )}

              <dl className="space-y-1 border-t border-slate-200 px-6 py-4 text-sm">
                <div className="flex justify-between text-slate-600">
                  <dt>Subtotal</dt>
                  <dd className="tabular-nums">{formatMoney(est.subtotal, cur)}</dd>
                </div>
                {Number(est.discount_total) ? (
                  <div className="flex justify-between text-slate-600">
                    <dt>Discounts</dt>
                    <dd className="tabular-nums">−{formatMoney(est.discount_total, cur)}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between text-slate-600">
                  <dt>
                    {est.tax_label} ({Number(est.tax_rate)}%)
                  </dt>
                  <dd className="tabular-nums">{formatMoney(est.tax_total, cur)}</dd>
                </div>
                <div className="flex justify-between pt-1 text-base font-semibold text-slate-900">
                  <dt>Total</dt>
                  <dd className="tabular-nums">{formatMoney(est.total, cur)}</dd>
                </div>
                {decision && decision.decision !== "rejected" ? (
                  <div className="flex justify-between font-medium text-emerald-700">
                    <dt>Approved by customer</dt>
                    <dd className="tabular-nums">{formatMoney(decision.approved_total, cur)}</dd>
                  </div>
                ) : null}
              </dl>
            </Card>

            {est.status === "draft" ? (
              <>
                {findings.filter((f) => !onEstimate.has(f.category)).length ? (
                  <Card className="p-6">
                    <h2 className="text-sm font-semibold text-slate-900">From the inspection</h2>
                    <p className="mb-3 text-xs text-slate-500">Add a finding as a recommended line, then set its price with Edit.</p>
                    <ul className="space-y-2">
                      {findings
                        .filter((f) => !onEstimate.has(f.category))
                        .map((f) => (
                          <li key={f.category} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                            <span>
                              <span className="font-medium text-slate-900">{CATEGORY_LABELS[f.category]}</span>
                              <span className="ml-2 text-slate-600">
                                {OUTCOME_LABELS[f.outcome]}
                                {f.notes ? ` — ${f.notes}` : ""}
                              </span>
                            </span>
                            <form action={addFindingLine}>
                              <input type="hidden" name="estimateId" value={est.id} />
                              <input type="hidden" name="jobId" value={job.id} />
                              <input type="hidden" name="category" value={f.category} />
                              <button type="submit" className={buttonClass("secondary", "py-1 text-xs")}>
                                Add to estimate
                              </button>
                            </form>
                          </li>
                        ))}
                    </ul>
                  </Card>
                ) : null}

                <Card className="p-6">
                  <h2 className="mb-3 text-sm font-semibold text-slate-900">Add a line</h2>
                  <AddLineForm
                    estimateId={est.id}
                    jobId={job.id}
                    currency={cur}
                    labour={(catalogue?.[0].data ?? []).map((l) => ({
                      id: l.id,
                      name: l.name,
                      price: Number(l.default_price),
                      detail: l.estimated_minutes ? `${l.estimated_minutes} min` : undefined,
                    }))}
                    parts={(catalogue?.[1].data ?? []).map((p) => ({
                      id: p.id,
                      name: p.name,
                      price: Number(p.selling_price),
                      detail: [p.brand, p.part_number, `per ${p.unit}`].filter(Boolean).join(" · "),
                    }))}
                  />
                  {!catalogue?.[0].data?.length && !catalogue?.[1].data?.length && ctx.permissions.has("workshop.settings") ? (
                    <p className="mt-3 text-xs text-slate-500">
                      Tip: save common services and parts in{" "}
                      <Link href="/settings/catalogue" className="text-brand-700 hover:underline">
                        Settings → Labour and parts
                      </Link>{" "}
                      to add them in one click.
                    </p>
                  ) : null}
                </Card>

                <Card className="p-6">
                  <h2 className="mb-3 text-sm font-semibold text-slate-900">Details for the customer</h2>
                  <DetailsForm
                    key={est.updated_at}
                    estimateId={est.id}
                    jobId={job.id}
                    defaults={{ estimatedCompletion: est.estimated_completion ?? "", terms: est.terms ?? "", customerNote: est.customer_note ?? "" }}
                  />
                </Card>

              </>
            ) : null}

            {/* Same slot for draft and sent, so the link survives the refresh after sending. */}
            {est.status === "draft" || est.status === "sent" ? (
              <Card className="p-6">
                <h2 className="mb-1 text-sm font-semibold text-slate-900">
                  {est.status === "draft" ? "Send for approval" : `Waiting for ${c.name}`}
                </h2>
                {est.status === "sent" ? (
                  <p className="mb-3 text-sm text-slate-600">
                    The customer approves or declines each line from the link. If they told you in person or by phone, record it below.
                  </p>
                ) : null}
                <SharePanel
                  estimateId={est.id}
                  status={est.status}
                  {...share}
                  disabledReason={
                    est.status === "sent"
                      ? undefined
                      : !lines?.length
                        ? "Add at least one line first."
                        : job.status !== "awaiting_estimate"
                          ? "The job must be awaiting an estimate to send one."
                          : undefined
                  }
                />
              </Card>
            ) : null}

            {est.status === "sent" ? (
              <>
                <Card className="p-6">
                  <h2 className="mb-3 text-sm font-semibold text-slate-900">Record the customer&apos;s decision</h2>
                  <DecisionForm
                    estimateId={est.id}
                    jobId={job.id}
                    currency={cur}
                    lines={(lines ?? []).map((l) => ({ id: l.id, description: l.description, total: Number(l.line_total) }))}
                  />
                </Card>
              </>
            ) : null}

            {decision ? (
              <Alert tone={decision.decision === "rejected" ? "info" : "success"}>
                {decision.decision === "approved" ? "Approved" : decision.decision === "rejected" ? "Declined" : "Partly approved"} by{" "}
                {decision.customer_name ?? "the customer"} via {METHOD_LABELS[decision.method]} on {formatDateTime(decision.decided_at, tz)}
                {decision.recorder ? ` — recorded by ${decision.recorder.full_name || decision.recorder.email}` : ""}.
                {decision.note ? ` Note: ${decision.note}` : ""}
              </Alert>
            ) : null}

            {canRevise ? (
              <Card className="p-6">
                <h2 className="mb-1 text-sm font-semibold text-slate-900">Change the estimate</h2>
                <p className="mb-3 text-sm text-slate-600">
                  Creates version {est.version + 1} with the same lines. Every line goes back to pending — the customer approves the new
                  version again, even lines they approved before.
                  {est.status === "sent" ? " The current link stops working." : ""}
                </p>
                <ReviseForm jobId={job.id} needsReason={needsReason} label={`Revise estimate (version ${est.version + 1})`} />
              </Card>
            ) : isLatest && est.status !== "draft" && job.status === "in_progress" ? (
              <Alert tone="info">
                Work is in progress. To add work, use “Additional work found” on the job card first; then revise the estimate here.
              </Alert>
            ) : null}

            {!isLatest ? <Alert tone="info">You&apos;re viewing an older version. It can&apos;t be approved any more.</Alert> : null}
          </div>

          <aside className="space-y-4">
            <Card className="p-4">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Versions</h2>
              <ol className="space-y-1">
                {versions?.map((ver) => (
                  <li key={ver.id}>
                    <Link
                      href={`/jobs/${job.id}/estimate?v=${ver.version}`}
                      aria-current={ver.id === est.id ? "page" : undefined}
                      className={cx(
                        "flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm",
                        ver.id === est.id ? "bg-brand-50 font-medium text-brand-900" : "text-slate-700 hover:bg-slate-50",
                      )}
                    >
                      <span>Version {ver.version}</span>
                      <span className="text-xs text-slate-500">{ESTIMATE_STATUS_LABELS[ver.status]}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            </Card>
            <Card className="p-4 text-sm">
              <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Customer complaint</h2>
              <p className="text-slate-700">{job.complaint}</p>
            </Card>
          </aside>
        </div>
      )}
    </>
  );
}
