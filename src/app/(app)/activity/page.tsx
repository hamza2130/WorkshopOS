import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Card, PageHeader } from "@/components/ui";
import { ROLE_LABELS, type Role } from "@/lib/auth/permissions";
import { requirePageAccess } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { isJobStatus, JOB_STATUS_LABELS } from "@/lib/job-status";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Activity" };

type Meta = {
  email?: string;
  role?: Role;
  from?: string;
  to?: string;
  user_id?: string;
  fields?: string[];
  reason?: string;
  file_name?: string;
  version?: number;
  decision?: string;
};

const statusLabel = (s?: string) => (s && isJobStatus(s) ? JOB_STATUS_LABELS[s] : s ?? "?");

type Names = {
  people: Map<string, string>;
  customers: Map<string, string>;
  vehicles: Map<string, string>;
  jobs: Map<string, string>;
};

const FALLBACK = { customers: "a customer", vehicles: "a vehicle", jobs: "a job card" };

function record(kind: "customers" | "vehicles" | "jobs", id: string | null | undefined, names: Names): ReactNode {
  if (!id) return "a record";
  const label = names[kind].get(id) ?? FALLBACK[kind];
  return (
    <Link href={`/${kind}/${id}`} className="font-medium text-brand-700 hover:underline">
      {label}
    </Link>
  );
}

const roleLabel = (r?: string) => (r && r in ROLE_LABELS ? ROLE_LABELS[r as Role] : "a member");

function describe(action: string, entityId: string | null, meta: Meta, names: Names, byCustomer: boolean): ReactNode {
  const subject = (meta.user_id && names.people.get(meta.user_id)) || "a member";
  const fields = meta.fields?.map((f) => f.replaceAll("_", " ")).join(", ");
  switch (action) {
    case "workshop.created":
      return "created the workshop";
    case "workshop.updated":
      return "updated workshop settings";
    case "member.invited":
      return `invited ${meta.email} as ${roleLabel(meta.role)}`;
    case "member.joined":
      return `joined as ${roleLabel(meta.role)}`;
    case "member.role_changed":
      return `changed ${subject}'s role from ${roleLabel(meta.from)} to ${roleLabel(meta.to)}`;
    case "member.permissions_changed":
      return `changed ${subject}'s extra permissions`;
    case "member.deactivated":
      return `deactivated ${subject}`;
    case "member.activated":
      return `reactivated ${subject}`;
    case "customer.created":
      return <>added customer {record("customers", entityId, names)}</>;
    case "customer.updated":
      return <>updated {record("customers", entityId, names)}{fields ? ` (${fields})` : ""}</>;
    case "customer.archived":
      return <>archived customer {record("customers", entityId, names)}</>;
    case "customer.restored":
      return <>restored customer {record("customers", entityId, names)}</>;
    case "customer.shared_phone_confirmed":
      return <>confirmed {record("customers", entityId, names)} shares a phone number with another customer</>;
    case "vehicle.created":
      return <>added vehicle {record("vehicles", entityId, names)}</>;
    case "vehicle.updated":
      return <>updated {record("vehicles", entityId, names)}{fields ? ` (${fields})` : ""}</>;
    case "vehicle.archived":
      return <>archived vehicle {record("vehicles", entityId, names)}</>;
    case "vehicle.restored":
      return <>restored vehicle {record("vehicles", entityId, names)}</>;
    case "vehicle.transferred":
      return (
        <>
          transferred {record("vehicles", entityId, names)} from {record("customers", meta.from, names)} to{" "}
          {record("customers", meta.to, names)}
        </>
      );
    case "vehicle.duplicate_registration_allowed":
      return <>allowed a duplicate registration for {record("vehicles", entityId, names)}: “{meta.reason}”</>;
    case "job_card.created":
      return <>opened job card {record("jobs", entityId, names)}</>;
    case "job_card.updated":
      return <>updated {record("jobs", entityId, names)}{fields ? ` (${fields})` : ""}</>;
    case "job_card.status_changed":
      return (
        <>
          moved {record("jobs", entityId, names)} from {statusLabel(meta.from)} to {statusLabel(meta.to)}
          {meta.reason ? ` — “${meta.reason}”` : ""}
        </>
      );
    case "job_card.attachment_removed":
      return <>removed {meta.file_name} from {record("jobs", entityId, names)}</>;
    case "inspection.completed":
      return <>completed the inspection on {record("jobs", entityId, names)}</>;
    case "estimate.created":
      return (
        <>
          started estimate version {meta.version} for {record("jobs", entityId, names)}
          {meta.reason ? ` — “${meta.reason}”` : ""}
        </>
      );
    case "estimate.sent":
      return <>sent estimate version {meta.version} for {record("jobs", entityId, names)} to the customer</>;
    case "estimate.link_renewed":
      return <>issued a new approval link for {record("jobs", entityId, names)}</>;
    case "estimate.decided": {
      const outcome = meta.decision === "approved" ? "approved" : meta.decision === "rejected" ? "declined" : "partly approved";
      return byCustomer ? (
        <>
          responded to estimate version {meta.version} for {record("jobs", entityId, names)}: {outcome}
        </>
      ) : (
        <>
          recorded the customer&apos;s decision on {record("jobs", entityId, names)} (version {meta.version}: {outcome})
        </>
      );
    }
    case "labour_item.created":
    case "part.created":
      return <>added a {action.startsWith("part") ? "part" : "labour service"} to the catalogue</>;
    case "labour_item.updated":
    case "part.updated":
      return <>updated a catalogue {action.startsWith("part") ? "part" : "service"}{fields ? ` (${fields})` : ""}</>;
    default:
      return action;
  }
}

export default async function ActivityPage() {
  const ctx = await requirePageAccess("activity.view");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activity_logs")
    .select("id, action, entity_type, entity_id, metadata, created_at, actor:profiles(full_name, email)")
    .eq("workshop_id", ctx.workshop.workshopId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;

  const ids = (pred: (e: NonNullable<typeof data>[number], m: Meta) => (string | null | undefined)[]) => [
    ...new Set(data.flatMap((e) => pred(e, e.metadata as Meta)).filter((x): x is string => Boolean(x))),
  ];
  const personIds = ids((_, m) => [m.user_id]);
  const customerIds = ids((e, m) => (e.entity_type === "customer" ? [e.entity_id] : e.action === "vehicle.transferred" ? [m.from, m.to] : []));
  const vehicleIds = ids((e) => (e.entity_type === "vehicle" ? [e.entity_id] : []));
  const jobIds = ids((e) => (e.entity_type === "job_card" ? [e.entity_id] : []));

  const [people, customers, vehicles, jobs] = await Promise.all([
    personIds.length ? supabase.from("profiles").select("id, full_name, email").in("id", personIds) : { data: [] },
    customerIds.length ? supabase.from("customers").select("id, name").in("id", customerIds) : { data: [] },
    vehicleIds.length ? supabase.from("vehicles").select("id, registration_number").in("id", vehicleIds) : { data: [] },
    jobIds.length ? supabase.from("job_cards").select("id, job_number").in("id", jobIds) : { data: [] },
  ]);
  const names: Names = {
    people: new Map((people.data ?? []).map((p) => [p.id, p.full_name || p.email])),
    customers: new Map((customers.data ?? []).map((c) => [c.id, c.name])),
    vehicles: new Map((vehicles.data ?? []).map((v) => [v.id, v.registration_number])),
    jobs: new Map((jobs.data ?? []).map((j) => [j.id, j.job_number])),
  };

  return (
    <>
      <PageHeader title="Activity" description="Every significant change in your workshop, newest first." />
      <Card className="overflow-hidden">
        {data.length === 0 ? (
          <p className="p-6 text-sm text-slate-600">No activity yet.</p>
        ) : (
          <ol className="divide-y divide-slate-100">
            {data.map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-2 px-6 py-3 text-sm">
                <p className="text-slate-800">
                  <span className="font-medium text-slate-900">
                    {e.actor?.full_name || e.actor?.email || (e.action === "estimate.decided" ? "Customer" : "System")}
                  </span>{" "}
                  {describe(e.action, e.entity_id, e.metadata as Meta, names, !e.actor)}
                </p>
                <time dateTime={e.created_at} className="text-xs text-slate-500">
                  {formatDateTime(e.created_at, ctx.workshop.timezone)}
                </time>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </>
  );
}
