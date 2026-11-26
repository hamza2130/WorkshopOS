import type { Metadata } from "next";
import Link from "next/link";
import { JobStatusBadge } from "@/components/job-status-badge";
import { Pagination, SearchBox } from "@/components/list-controls";
import { Alert, Badge, buttonClass, Card, cx, PageHeader } from "@/components/ui";
import { requirePageAccess } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { BILLABLE_STAGES, INVOICE_ERRORS, INVOICE_VIEWS, paymentState, PAYMENT_STATE_LABELS, PAYMENT_STATE_TONES, type InvoiceView } from "@/lib/invoices";
import { formatMoney } from "@/lib/money";
import { PAGE_SIZE, pageNumber, str, withParams } from "@/lib/params";
import { createClient } from "@/lib/supabase/server";
import { createInvoice } from "./actions";

export const metadata: Metadata = { title: "Invoices" };

export default async function InvoicesPage({ searchParams }: PageProps<"/invoices">) {
  const ctx = await requirePageAccess("invoices.manage", "payments.record", "jobs.manage");
  const sp = await searchParams;
  const viewParam = str(sp, "view");
  const view: InvoiceView = viewParam in INVOICE_VIEWS ? (viewParam as InvoiceView) : "unpaid";
  // Search text goes into a PostgREST filter: keep only characters that can't change its meaning.
  const q = str(sp, "q").replace(/[^\p{L}\p{N}\s-]/gu, "").trim().slice(0, 60);
  const page = pageNumber(sp);
  const error = str(sp, "error");
  const ws = ctx.workshop.workshopId;
  const cur = ctx.workshop.currency;
  const canManage = ctx.permissions.has("invoices.manage");

  const supabase = await createClient();
  let query = supabase
    .from("invoices")
    .select("id, invoice_number, status, total, amount_paid, balance_due, issued_at, created_at, customer_name, vehicle_registration, job:job_cards(job_number), customer:customers(name), vehicle:vehicles(registration_number)", { count: "exact" })
    .eq("workshop_id", ws);
  if (view === "unpaid") query = query.eq("status", "issued").gt("balance_due", 0);
  else if (view === "paid") query = query.eq("status", "issued").lte("balance_due", 0);
  else if (view === "draft" || view === "void") query = query.eq("status", view);
  if (q) {
    const like = `%${q}%`;
    query = query.or(`invoice_number.ilike.${like},customer_name.ilike.${like},vehicle_registration.ilike.${like}`);
  }
  const from = (page - 1) * PAGE_SIZE;

  const [list, ready, live, summary] = await Promise.all([
    query.order("created_at", { ascending: false }).range(from, from + PAGE_SIZE - 1),
    // Finished work with no invoice yet.
    supabase
      .from("job_cards")
      .select("id, job_number, status, customer:customers(name), vehicle:vehicles(registration_number, make, model)")
      .eq("workshop_id", ws)
      .in("status", [...BILLABLE_STAGES])
      .order("status_changed_at", { ascending: true })
      .limit(100),
    supabase.from("invoices").select("job_card_id").eq("workshop_id", ws).neq("status", "void"),
    // Only the outstanding figure is used here; an empty period keeps the other sums at zero.
    supabase.rpc("billing_summary", { ws, p_from: new Date(0).toISOString(), p_to: new Date(0).toISOString() }),
  ]);
  if (list.error) throw list.error;
  const billed = new Set((live.data ?? []).map((i) => i.job_card_id));
  const toBill = (ready.data ?? []).filter((j) => !billed.has(j.id) && j.status !== "delivered");
  const outstanding = Number(summary.data?.[0]?.outstanding ?? 0);
  const unpaidCount = Number(summary.data?.[0]?.unpaid_count ?? 0);

  return (
    <>
      <PageHeader
        title="Invoices"
        description={
          unpaidCount
            ? `${formatMoney(outstanding, cur)} outstanding on ${unpaidCount} invoice${unpaidCount === 1 ? "" : "s"}.`
            : "Nothing outstanding."
        }
      />

      {error ? (
        <div className="mb-4">
          <Alert tone="error">{INVOICE_ERRORS[error] ?? "We couldn't create that invoice."}</Alert>
        </div>
      ) : null}

      {toBill.length ? (
        <Card className="mb-6 overflow-hidden">
          <h2 className="border-b border-slate-200 px-6 py-3 text-sm font-semibold text-slate-900">
            Ready to bill ({toBill.length})
          </h2>
          <ul className="divide-y divide-slate-100">
            {toBill.map((j) => (
              <li key={j.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-3">
                <div className="text-sm">
                  <span className="font-medium text-slate-900">{j.job_number}</span>
                  <span className="ml-2 text-slate-600">
                    {j.vehicle?.registration_number} · {j.vehicle?.make} {j.vehicle?.model} · {j.customer?.name}
                  </span>
                  <span className="ml-2">
                    <JobStatusBadge status={j.status} />
                  </span>
                </div>
                {canManage ? (
                  <form action={createInvoice}>
                    <input type="hidden" name="jobId" value={j.id} />
                    <button type="submit" className={buttonClass("primary", "py-1.5")}>
                      Create invoice
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <nav aria-label="Invoice views" className="mb-4 flex flex-wrap gap-1 border-b border-slate-200">
        {(Object.keys(INVOICE_VIEWS) as InvoiceView[]).map((key) => (
          <Link
            key={key}
            href={withParams("/invoices", { view: key === "unpaid" ? undefined : key, q })}
            aria-current={key === view ? "page" : undefined}
            className={cx(
              "-mb-px border-b-2 px-3 py-2 text-sm",
              key === view ? "border-brand-600 font-medium text-brand-900" : "border-transparent text-slate-600 hover:text-slate-900",
            )}
          >
            {INVOICE_VIEWS[key].label}
          </Link>
        ))}
      </nav>

      <div className="mb-4">
        <SearchBox action="/invoices" q={q} placeholder="INV-0001, customer or registration" hidden={view !== "unpaid" ? { view } : {}} />
      </div>

      <Card className="overflow-hidden">
        {list.data.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-600">
            {q ? <>No invoices match &ldquo;{q}&rdquo;.</> : view === "unpaid" ? "No unpaid invoices." : "No invoices here."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-6 py-2.5 font-medium">Invoice</th>
                  <th scope="col" className="px-6 py-2.5 font-medium">Customer</th>
                  <th scope="col" className="px-6 py-2.5 text-right font-medium">Total</th>
                  <th scope="col" className="px-6 py-2.5 text-right font-medium">Balance</th>
                  <th scope="col" className="px-6 py-2.5 font-medium">State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.data.map((i) => {
                  const st = paymentState(i.status, Number(i.total), Number(i.amount_paid));
                  return (
                    <tr key={i.id} className="hover:bg-slate-50">
                      <td className="px-6 py-3">
                        <Link href={`/invoices/${i.id}`} className="font-medium text-slate-900 hover:text-brand-700 hover:underline">
                          {i.invoice_number ?? "Draft"}
                        </Link>
                        <span className="block text-xs text-slate-500">
                          {i.job?.job_number} · {formatDate(i.issued_at ?? i.created_at, ctx.workshop.timezone)}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        <span className="text-slate-800">{i.customer_name ?? i.customer?.name}</span>
                        <span className="block text-xs text-slate-500">{i.vehicle_registration ?? i.vehicle?.registration_number}</span>
                      </td>
                      <td className="px-6 py-3 text-right tabular-nums">{formatMoney(i.total, cur)}</td>
                      <td className={cx("px-6 py-3 text-right tabular-nums", Number(i.balance_due) > 0 && i.status === "issued" ? "font-medium text-slate-900" : "text-slate-500")}>
                        {i.status === "issued" ? formatMoney(i.balance_due, cur) : "—"}
                      </td>
                      <td className="px-6 py-3">
                        <Badge tone={PAYMENT_STATE_TONES[st]}>{PAYMENT_STATE_LABELS[st]}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pagination path="/invoices" params={{ q, ...(view !== "unpaid" ? { view } : {}) }} page={page} pageSize={PAGE_SIZE} total={list.count ?? 0} />
      </Card>
    </>
  );
}
