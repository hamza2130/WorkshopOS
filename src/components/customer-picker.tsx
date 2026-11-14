import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SearchBox } from "./list-controls";
import { buttonClass, Card } from "./ui";

// Server-rendered customer search used wherever a vehicle needs an owner.
export async function CustomerPicker({
  workshopId,
  q,
  action,
  hidden,
  hrefFor,
  actionLabel,
  excludeId,
}: {
  workshopId: string;
  q: string;
  action: string;
  hidden?: Record<string, string>;
  hrefFor: (customerId: string) => string;
  actionLabel: string;
  excludeId?: string;
}) {
  const supabase = await createClient();
  const { data } = q
    ? await supabase.rpc("search_customers", { ws: workshopId, q, p_limit: 10 })
    : { data: [] };
  const results = (data ?? []).filter((c) => c.id !== excludeId);

  return (
    <div className="space-y-4">
      <SearchBox action={action} q={q} placeholder="Customer name or phone" hidden={hidden} />
      {q ? (
        <Card className="overflow-hidden">
          {results.length ? (
            <ul className="divide-y divide-slate-100">
              {results.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <div className="text-sm">
                    <span className="font-medium text-slate-900">{c.name}</span>
                    <span className="ml-2 text-slate-600">
                      {c.phone} · {c.code} · {c.vehicle_count} vehicle{c.vehicle_count === 1 ? "" : "s"}
                    </span>
                  </div>
                  <Link href={hrefFor(c.id)} className={buttonClass("secondary", "py-1.5")}>
                    {actionLabel}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-4 text-sm text-slate-600">No customers match &ldquo;{q}&rdquo;.</p>
          )}
        </Card>
      ) : null}
    </div>
  );
}
