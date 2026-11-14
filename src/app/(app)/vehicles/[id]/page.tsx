import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArchiveButton } from "@/components/archive-button";
import { Alert, Badge, buttonClass, Card, PageHeader } from "@/components/ui";
import { requirePageAccess } from "@/lib/auth/session";
import { formatDate, formatDateTime } from "@/lib/format";
import { isUuid } from "@/lib/params";
import { FUEL_LABELS, TRANSMISSION_LABELS } from "@/lib/record-schemas";
import { createClient } from "@/lib/supabase/server";
import { setVehicleArchived } from "../actions";
import { MileageForm } from "./mileage-form";

export const metadata: Metadata = { title: "Vehicle" };

const SOURCE_LABELS: Record<string, string> = {
  registration: "At registration",
  manual: "Manual entry",
  job: "Job card",
};

export default async function VehiclePage({ params }: PageProps<"/vehicles/[id]">) {
  const ctx = await requirePageAccess("vehicles.manage");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const tz = ctx.workshop.timezone;

  const supabase = await createClient();
  const [{ data: v }, { data: readings }] = await Promise.all([
    supabase
      .from("vehicles")
      .select("*, customers(id, name, code, phone)")
      .eq("id", id)
      .eq("workshop_id", ctx.workshop.workshopId)
      .maybeSingle(),
    supabase
      .from("vehicle_mileage_readings")
      .select("id, reading, source, note, recorded_at, profiles(full_name, email)")
      .eq("vehicle_id", id)
      .order("recorded_at", { ascending: false })
      .limit(50),
  ]);
  if (!v) notFound();

  const owner = v.customers;
  const details: [string, string | null][] = [
    ["Make and model", [v.make, v.model, v.variant].filter(Boolean).join(" ")],
    ["Year", v.year?.toString() ?? null],
    ["Colour", v.colour],
    ["Engine", v.engine_cc ? `${v.engine_cc.toLocaleString("en-PK")} cc` : null],
    ["Fuel", v.fuel_type ? FUEL_LABELS[v.fuel_type] : null],
    ["Transmission", v.transmission ? TRANSMISSION_LABELS[v.transmission] : null],
    ["VIN / chassis", v.vin],
    ["Engine number", v.engine_number],
  ];
  const current = readings?.[0];

  return (
    <>
      <PageHeader
        title={v.registration_number}
        description={`${[v.make, v.model, v.variant, v.year].filter(Boolean).join(" ")} · added ${formatDate(v.created_at, tz)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/vehicles/${v.id}/edit`} className={buttonClass("secondary")}>
              Edit
            </Link>
            <Link href={`/vehicles/${v.id}/transfer`} className={buttonClass("secondary")}>
              Transfer owner
            </Link>
            {ctx.workshop.role === "owner" ? (
              <ArchiveButton action={setVehicleArchived} idField="vehicleId" id={v.id} archived={Boolean(v.archived_at)} noun="vehicle" />
            ) : null}
          </div>
        }
      />

      {v.archived_at ? (
        <div className="mb-6">
          <Alert tone="info">This vehicle was archived on {formatDate(v.archived_at, tz)}. Its history is kept.</Alert>
        </div>
      ) : null}
      {v.duplicate_registration_reason ? (
        <div className="mb-6">
          <Alert tone="info">
            Shares its registration number with another vehicle. Reason recorded: {v.duplicate_registration_reason}
          </Alert>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="text-sm font-semibold text-slate-900">Owner</h2>
            {owner ? (
              <div className="mt-3 text-sm">
                <Link href={`/customers/${owner.id}`} className="font-medium text-brand-700 hover:underline">
                  {owner.name}
                </Link>
                <p className="text-slate-600">
                  {owner.code} · {owner.phone}
                </p>
              </div>
            ) : null}
          </Card>
          <Card className="p-6">
            <h2 className="text-sm font-semibold text-slate-900">Details</h2>
            <dl className="mt-3 space-y-2 text-sm">
              {details.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4">
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="text-right text-slate-900">{value || "—"}</dd>
                </div>
              ))}
            </dl>
            {v.notes ? <p className="mt-4 whitespace-pre-line border-t border-slate-100 pt-3 text-sm text-slate-700">{v.notes}</p> : null}
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 px-6 py-3">
              <h2 className="text-sm font-semibold text-slate-900">Mileage history</h2>
              {current ? (
                <span className="text-sm text-slate-600">
                  Current: <span className="font-semibold tabular-nums text-slate-900">{current.reading.toLocaleString("en-PK")} km</span>
                </span>
              ) : null}
            </div>
            {!v.archived_at ? (
              <div className="border-b border-slate-100 px-6 py-4">
                <MileageForm vehicleId={v.id} />
              </div>
            ) : null}
            {readings?.length ? (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th scope="col" className="px-6 py-2 text-right font-medium">Reading</th>
                    <th scope="col" className="px-6 py-2 font-medium">Recorded</th>
                    <th scope="col" className="hidden px-6 py-2 font-medium sm:table-cell">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {readings.map((r) => (
                    <tr key={r.id}>
                      <td className="px-6 py-2.5 text-right tabular-nums text-slate-900">{r.reading.toLocaleString("en-PK")} km</td>
                      <td className="px-6 py-2.5 text-slate-700">
                        {formatDateTime(r.recorded_at, tz)}
                        <span className="block text-xs text-slate-500">
                          {r.profiles?.full_name || r.profiles?.email || ""}
                          {r.note ? ` · ${r.note}` : ""}
                        </span>
                      </td>
                      <td className="hidden px-6 py-2.5 text-slate-600 sm:table-cell">
                        <Badge tone="muted">{SOURCE_LABELS[r.source] ?? r.source}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="px-6 py-4 text-sm text-slate-600">No readings yet.</p>
            )}
          </Card>

          <Card className="p-6">
            <h2 className="text-sm font-semibold text-slate-900">Service history</h2>
            <p className="mt-1 text-sm text-slate-600">
              Every completed job card for this vehicle — complaints, inspections, parts replaced and invoices — will be listed
              here once job cards arrive. Past entries are never overwritten.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
