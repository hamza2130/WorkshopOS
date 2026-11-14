import type { Metadata } from "next";
import Link from "next/link";
import { Pagination, SearchBox } from "@/components/list-controls";
import { Badge, buttonClass, Card, PageHeader } from "@/components/ui";
import { requirePageAccess } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { PAGE_SIZE, pageNumber, str } from "@/lib/params";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Customers" };

export default async function CustomersPage({ searchParams }: PageProps<"/customers">) {
  const ctx = await requirePageAccess("customers.manage");
  const sp = await searchParams;
  const q = str(sp, "q").slice(0, 100);
  const archived = str(sp, "archived") === "1";
  const page = pageNumber(sp);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_customers", {
    ws: ctx.workshop.workshopId,
    q,
    include_archived: archived,
    p_limit: PAGE_SIZE,
    p_offset: (page - 1) * PAGE_SIZE,
  });
  if (error) throw error;
  const total = Number(data[0]?.total_count ?? 0);
  const params = { q, archived: archived ? "1" : "" };

  return (
    <>
      <PageHeader
        title="Customers"
        description="Search by name, phone number or customer code."
        actions={
          <Link href="/customers/new" className={buttonClass("primary")}>
            New customer
          </Link>
        }
      />
      <div className="mb-4">
        <SearchBox action="/customers" q={q} placeholder="Name, phone or C-0001" showArchived={archived} />
      </div>

      <Card className="overflow-hidden">
        {data.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-600">
            {q ? (
              <>
                No customers match &ldquo;{q}&rdquo;.{" "}
                <Link href="/customers/new" className="text-brand-700 hover:underline">
                  Add a new customer
                </Link>
              </>
            ) : (
              "No customers yet. Add your first one to get started."
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-6 py-2.5 font-medium">Customer</th>
                  <th scope="col" className="px-6 py-2.5 font-medium">Phone</th>
                  <th scope="col" className="px-6 py-2.5 text-right font-medium">Vehicles</th>
                  <th scope="col" className="hidden px-6 py-2.5 font-medium md:table-cell">Added</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-6 py-3">
                      <Link href={`/customers/${c.id}`} className="font-medium text-slate-900 hover:text-brand-700 hover:underline">
                        {c.name}
                      </Link>
                      <span className="ml-2 text-xs text-slate-500">{c.code}</span>
                      {c.archived_at ? (
                        <span className="ml-2">
                          <Badge tone="muted">Archived</Badge>
                        </span>
                      ) : null}
                    </td>
                    <td className="px-6 py-3 text-slate-700">{c.phone}</td>
                    <td className="px-6 py-3 text-right tabular-nums text-slate-700">{c.vehicle_count}</td>
                    <td className="hidden px-6 py-3 text-slate-600 md:table-cell">{formatDate(c.created_at, ctx.workshop.timezone)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination path="/customers" params={params} page={page} pageSize={PAGE_SIZE} total={total} />
      </Card>
    </>
  );
}
