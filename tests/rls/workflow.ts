import { anonClient, type Client } from "./helpers";

// Drives a job through the real inspection and estimate functions, as the app does.

export async function completeInspection(client: Client, job: string) {
  const started = await client.rpc("start_inspection", { p_job: job });
  if (started.error) throw started.error;
  const done = await client.rpc("complete_inspection", { p_job: job });
  if (done.error) throw done.error;
}

export async function draftEstimate(
  client: Client,
  ws: string,
  job: string,
  lines: { description: string; unit_price: number; quantity?: number; kind?: "labour" | "part" | "other" }[] = [
    { description: "Brake pads", unit_price: 4500 },
  ],
  reason?: string,
) {
  const created = await client.rpc("create_estimate", { p_job: job, p_reason: reason });
  if (created.error) throw created.error;
  const estimate = created.data;
  if (lines.length) {
    // Revisions already contain the previous lines; new ones go after them.
    const { count } = await client.from("estimate_items").select("id", { count: "exact", head: true }).eq("estimate_id", estimate);
    const items = await client
      .from("estimate_items")
      .insert(lines.map((l, i) => ({ workshop_id: ws, estimate_id: estimate, position: (count ?? 0) + i, kind: "part" as const, ...l })))
      .select("id");
    if (items.error) throw items.error;
  }
  return estimate;
}

export async function sendEstimate(client: Client, estimate: string) {
  const sent = await client.rpc("send_estimate", { p_estimate: estimate });
  if (sent.error) throw sent.error;
  return sent.data;
}

export async function itemIds(client: Client, estimate: string) {
  const { data } = await client.from("estimate_items").select("id").eq("estimate_id", estimate).order("position");
  return (data ?? []).map((r) => r.id);
}

/** Customer approves every line from the link, signed out. */
export async function approveAll(token: string, approvedIds: string[]) {
  return anonClient().rpc("respond_to_estimate", { p_token: token, p_approved: approvedIds, p_customer_name: "Test Customer" });
}

export function move(client: Client, job: string, action: string, expected: string, reason?: string) {
  return client.rpc("change_job_status", {
    p_job: job,
    p_action: action,
    p_expected_status: expected as never,
    p_reason: reason,
  });
}

/** From check-in to Ready for delivery: approval, then the work moves with no tasks. */
export async function readyForDelivery(client: Client, ws: string, job: string, lines?: Parameters<typeof draftEstimate>[3]) {
  await completeInspection(client, job);
  const estimate = await draftEstimate(client, ws, job, lines);
  const token = await sendEstimate(client, estimate);
  const res = await approveAll(token, await itemIds(client, estimate));
  if (res.error) throw res.error;
  for (const [action, from] of [
    ["request_assignment", "approved"],
    ["start_work", "awaiting_assignment"],
    ["finish_work", "in_progress"],
    ["pass_quality_check", "quality_check"],
  ]) {
    const moved = await move(client, job, action, from);
    if (moved.error) throw moved.error;
  }
  return estimate;
}

/** Drafts and issues the job's invoice (needs invoices.manage). Returns the invoice id. */
export async function billJob(client: Client, job: string) {
  const created = await client.rpc("create_invoice", { p_job: job });
  if (created.error) throw created.error;
  const issued = await client.rpc("issue_invoice", { p_invoice: created.data });
  if (issued.error) throw issued.error;
  return created.data;
}

/** From check-in to Approved via inspection, estimate and the customer's link. */
export async function approveThroughEstimate(client: Client, ws: string, job: string) {
  await completeInspection(client, job);
  const estimate = await draftEstimate(client, ws, job);
  const token = await sendEstimate(client, estimate);
  const res = await approveAll(token, await itemIds(client, estimate));
  if (res.error) throw res.error;
  return estimate;
}
