import type { Metadata } from "next";
import Link from "next/link";
import { Pagination, SearchBox } from "@/components/list-controls";
import { Badge, buttonClass, Card, PageHeader } from "@/components/ui";
import { requirePageAccess } from "@/lib/auth/session";
import { PAGE_SIZE, pageNumber, str } from "@/lib/params";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Vehicles" };

export default async function VehiclesPage({ searchParams }: PageProps<"/vehicles">) {
  const ctx = await requirePageAccess("vehicles.manage");
  const sp = await searchParams;
  const q = str(sp, "q").slice(0, 100);
  const archived = str(sp, "archived") === "1";
  const page = pageNumber(sp);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_vehicles", {
    ws: ctx.workshop.workshopId,
    q,
    include_archived: archived,
    p_limit: PAGE_SIZE,
    p_offset: (page - 1) * PAGE_SIZE,
  });
  if (error) throw error;
  const total = Number(data[0]?.total_count ?? 0);

  return (
    <>
      <PageHeader
        title="Vehicles"
        description="Search by registration number, make or model, or the owner's name or phone."
        actions={
          <Link href="/vehicles/new" className={buttonClass("primary")}>
            Add vehicle
          </Link>
        }
      />
      <div className="mb-4">
        <SearchBox action="/vehicles" q={q} placeholder="LEA-1234, Corolla, owner name or phone" showArchived={archived} />
      </div>

      <Card className="overflow-hidden">
        {data.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-600">
            {q ? <>No vehicles match &ldquo;{q}&rdquo;.</> : "No vehicles yet. Add one from a customer's page or with Add vehicle."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-6 py-2.5 font-medium">Registration</th>
                  <th scope="col" className="px-6 py-2.5 font-medium">Vehicle</th>
                  <th scope="col" className="px-6 py-2.5 font-medium">Owner</th>
                  <th scope="col" className="hidden px-6 py-2.5 text-right font-medium md:table-cell">Mileage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50">
                    <td className="px-6 py-3">
                      <Link href={`/vehicles/${v.id}`} className="font-medium text-slate-900 hover:text-brand-700 hover:underline">
                        {v.registration_number}
                      </Link>
                      {v.archived_at ? (
                        <span className="ml-2">
                          <Badge tone="muted">Archived</Badge>
                        </span>
                      ) : null}
                    </td>
                    <td className="px-6 py-3 text-slate-700">
                      {[v.make, v.model, v.variant, v.year].filter(Boolean).join(" ")}
                      {v.colour ? <span className="text-slate-500"> · {v.colour}</span> : null}
                    </td>
                    <td className="px-6 py-3">
                      <Link href={`/customers/${v.customer_id}`} className="text-slate-800 hover:text-brand-700 hover:underline">
                        {v.customer_name}
                      </Link>
                      <span className="block text-xs text-slate-500">{v.customer_phone}</span>
                    </td>
                    <td className="hidden px-6 py-3 text-right tabular-nums text-slate-700 md:table-cell">
                      {v.current_mileage !== null ? `${v.current_mileage.toLocaleString("en-PK")} km` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination path="/vehicles" params={{ q, archived: archived ? "1" : "" }} page={page} pageSize={PAGE_SIZE} total={total} />
      </Card>
    </>
  );
}
