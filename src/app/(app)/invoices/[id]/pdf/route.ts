import { getWorkshopContext } from "@/lib/auth/session";
import { invoicePdfData, loadInvoice } from "@/lib/billing";
import { renderInvoicePdf } from "@/lib/invoice-pdf";
import { isUuid } from "@/lib/params";

// Made on request from the same rows the invoice page shows; row-level security
// decides what this user may read, so another workshop's invoice is a 404.
export async function GET(_req: Request, ctx: RouteContext<"/invoices/[id]/pdf">) {
  const { id } = await ctx.params;
  const session = await getWorkshopContext();
  const allowed = ["invoices.manage", "payments.record", "jobs.manage"] as const;
  if (!isUuid(id) || !allowed.some((p) => session.permissions.has(p))) return new Response("Not found", { status: 404 });

  const loaded = await loadInvoice(id, session.workshop.workshopId);
  if (!loaded) return new Response("Not found", { status: 404 });

  const data = await invoicePdfData(loaded, session.workshop.workshopId, session.workshop.timezone, session.workshop.currency);
  const bytes = await renderInvoicePdf(data);
  const name = (loaded.invoice.invoice_number ?? `draft-${loaded.job.job_number}`).replace(/[^A-Za-z0-9-]/g, "");
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${name}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
