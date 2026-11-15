import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JobStatusBadge } from "@/components/job-status-badge";
import { SearchBox } from "@/components/list-controls";
import { Alert, buttonClass, Card, PageHeader } from "@/components/ui";
import { requirePageAccess } from "@/lib/auth/session";
import { IN_WORKSHOP } from "@/lib/job-status";
import { isUuid, str, withParams } from "@/lib/params";
import { getServiceAdvisors } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";
import { JobForm } from "../job-form";

export const metadata: Metadata = { title: "New job card" };

export default async function NewJobPage({ searchParams }: PageProps<"/jobs/new">) {
  const ctx = await requirePageAccess("jobs.manage");
  const sp = await searchParams;
  const vehicleId = str(sp, "vehicleId");
  const wsId = ctx.workshop.workshopId;
  const supabase = await createClient();

  if (!vehicleId) {
    const q = str(sp, "q").slice(0, 100);
    const [vehicles, customers] = q
      ? await Promise.all([
          supabase.rpc("search_vehicles", { ws: wsId, q, p_limit: 10 }),
          supabase.rpc("search_customers", { ws: wsId, q, p_limit: 5 }),
        ])
      : [{ data: [] }, { data: [] }];

    return (
      <>
        <PageHeader
          title="New job card"
          description="Find the vehicle by its plate, or the customer by name or phone."
          actions={
            <Link href={withParams("/customers/new", { then: "checkin" })} className={buttonClass("secondary")}>
              New customer
            </Link>
          }
        />
        <div className="max-w-3xl space-y-4">
          <SearchBox action="/jobs/new" q={q} placeholder="LEA-1234, customer name or phone" />
          {q ? (
            <>
              <Card className="overflow-hidden">
                <h2 className="border-b border-slate-200 px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Vehicles</h2>
                {vehicles.data?.length ? (
                  <ul className="divide-y divide-slate-100">
                    {vehicles.data.map((v) => (
                      <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                        <div className="text-sm">
                          <span className="font-medium text-slate-900">{v.registration_number}</span>
                          <span className="ml-2 text-slate-600">
                            {[v.make, v.model, v.year].filter(Boolean).join(" ")} · {v.customer_name} · {v.customer_phone}
                          </span>
                        </div>
                        <Link href={withParams("/jobs/new", { vehicleId: v.id })} className={buttonClass("primary", "py-1.5")}>
                          Check in
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-5 py-3 text-sm text-slate-600">No vehicles match.</p>
                )}
              </Card>
              {customers.data?.length ? (
                <Card className="overflow-hidden">
                  <h2 className="border-b border-slate-200 px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Customers — bringing a car that isn&apos;t registered yet?
                  </h2>
                  <ul className="divide-y divide-slate-100">
                    {customers.data.map((c) => (
                      <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                        <div className="text-sm">
                          <span className="font-medium text-slate-900">{c.name}</span>
                          <span className="ml-2 text-slate-600">
                            {c.phone} · {c.vehicle_count} vehicle{c.vehicle_count === 1 ? "" : "s"}
                          </span>
                        </div>
                        <Link href={withParams("/vehicles/new", { customerId: c.id, then: "checkin" })} className={buttonClass("secondary", "py-1.5")}>
                          Add vehicle and check in
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Card>
              ) : null}
            </>
          ) : null}
        </div>
      </>
    );
  }

  if (!isUuid(vehicleId)) notFound();
  const [{ data: v }, { data: lastReading }, { data: openJobs }, advisors] = await Promise.all([
    supabase
      .from("vehicles")
      .select("id, registration_number, make, model, variant, year, archived_at, customers(id, name, code, phone, archived_at)")
      .eq("id", vehicleId)
      .eq("workshop_id", wsId)
      .maybeSingle(),
    supabase
      .from("vehicle_mileage_readings")
      .select("reading")
      .eq("vehicle_id", vehicleId)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("job_cards").select("id, job_number, status").eq("vehicle_id", vehicleId).in("status", [...IN_WORKSHOP, "draft"]),
    getServiceAdvisors(wsId),
  ]);
  if (!v || !v.customers) notFound();
  const owner = v.customers;
  const archived = v.archived_at || owner.archived_at;

  return (
    <>
      <PageHeader title={`Check in ${v.registration_number}`} description={[v.make, v.model, v.variant, v.year].filter(Boolean).join(" ")} />
      <div className="grid max-w-5xl gap-6 lg:grid-cols-3">
        <Card className="h-fit p-5 text-sm lg:order-2">
          <h2 className="font-semibold text-slate-900">Owner</h2>
          <Link href={`/customers/${owner.id}`} className="mt-2 block font-medium text-brand-700 hover:underline">
            {owner.name}
          </Link>
          <p className="text-slate-600">
            {owner.code} · {owner.phone}
          </p>
          <p className="mt-3 text-xs text-slate-500">
            Different person dropping it off? Note it in the observations. If the car has been sold,{" "}
            <Link href={`/vehicles/${v.id}/transfer`} className="text-brand-700 hover:underline">
              transfer it
            </Link>{" "}
            first.
          </p>
        </Card>
        <div className="space-y-4 lg:col-span-2">
          {archived ? <Alert>This vehicle or its owner is archived. Restore them before opening a job card.</Alert> : null}
          {openJobs?.length ? (
            <Alert tone="info">
              This vehicle already has an open job:{" "}
              {openJobs.map((j, i) => (
                <span key={j.id}>
                  {i > 0 ? ", " : ""}
                  <Link href={`/jobs/${j.id}`} className="font-medium underline">
                    {j.job_number}
                  </Link>{" "}
                  <JobStatusBadge status={j.status} />
                </span>
              ))}
              . Add to that job instead unless this is separate work.
            </Alert>
          ) : null}
          <Card className="p-6">
            <JobForm
              mode="create"
              vehicleId={v.id}
              lastMileage={lastReading?.reading ?? null}
              advisors={advisors}
              defaults={{ advisorId: advisors.some((a) => a.id === ctx.userId) ? ctx.userId : advisors[0]?.id }}
            />
          </Card>
        </div>
      </div>
    </>
  );
}
