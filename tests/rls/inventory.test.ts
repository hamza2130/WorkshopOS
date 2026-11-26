import { beforeAll, describe, expect, it } from "vitest";
import { addMember, admin, createWorkshop, run, userClient, type Client, type TestUser } from "./helpers";
import { approveAll, billJob, completeInspection, draftEstimate, itemIds, move, sendEstimate } from "./workflow";

let ownerA: TestUser;
let advisorA: TestUser;
let mechanicA: TestUser;
let stockA: TestUser;
let ownerB: TestUser;
let wsA: string;
let wsB: string;
let vehicleA: string;

async function newPart(name: string, extra: Record<string, unknown> = {}) {
  const res = await stockA.client
    .from("parts")
    .insert({ workshop_id: wsA, name, selling_price: 1000, cost_price: 600, unit: "piece", ...extra })
    .select("id")
    .single();
  if (res.error) throw res.error;
  return res.data.id;
}

async function stock(part: string) {
  const { data } = await admin.from("parts").select("stock_on_hand").eq("id", part).single();
  return Number(data?.stock_on_hand);
}

async function movements(part: string) {
  const { data } = await admin.from("stock_movements").select("kind, quantity, balance_after, reason, job_card_id, part_used_id").eq("part_id", part).order("id");
  return data ?? [];
}

/** A job whose customer approved one line for this catalogue part. */
async function approvedJobWithPart(part: string, quantity = 2) {
  const job = (await advisorA.client.rpc("create_job_card", { ws: wsA, p_vehicle: vehicleA, p_complaint: "Service" })).data!;
  await completeInspection(advisorA.client, job);
  const estimate = await draftEstimate(advisorA.client, wsA, job, [
    { description: "Brake pads", unit_price: 1000, quantity, kind: "part", part_id: part } as never,
  ]);
  const token = await sendEstimate(advisorA.client, estimate);
  await approveAll(token, await itemIds(advisorA.client, estimate));
  const [line] = await itemIds(advisorA.client, estimate);
  return { job, line };
}

function useLine(client: Client, job: string, line: string, quantity: number) {
  return client.from("job_parts_used").insert({ workshop_id: wsA, job_card_id: job, estimate_item_id: line, description: "Brake pads", quantity }).select("id").single();
}

beforeAll(async () => {
  [ownerA, advisorA, mechanicA, stockA, ownerB] = await Promise.all([
    userClient("p7-owner-a"),
    userClient("p7-advisor-a"),
    userClient("p7-mechanic-a"),
    userClient("p7-stock-a"),
    userClient("p7-owner-b"),
  ]);
  wsA = await createWorkshop(ownerA.client, `Alpha Stock ${run}`);
  wsB = await createWorkshop(ownerB.client, `Bravo Stock ${run}`);
  await addMember(ownerA.client, wsA, advisorA, "advisor");
  await addMember(ownerA.client, wsA, mechanicA, "mechanic");
  await addMember(ownerA.client, wsA, stockA, "inventory_manager");
  const c = await advisorA.client.from("customers").insert({ workshop_id: wsA, name: "Sara Javed", phone: "0300 7000001" }).select("id").single();
  const v = await advisorA.client
    .from("vehicles")
    .insert({ workshop_id: wsA, customer_id: c.data!.id, registration_number: "LEG-7001", make: "Suzuki", model: "Alto" })
    .select("id")
    .single();
  vehicleA = v.data!.id;
});

describe("stock only moves through a recorded movement (Phase 7 gate)", () => {
  it("refuses to set stock directly, for everyone including the service key", async () => {
    const part = await newPart("Oil filter");
    expect((await stockA.client.from("parts").update({ stock_on_hand: 50 } as never).eq("id", part)).error).not.toBeNull();
    expect((await admin.from("parts").update({ stock_on_hand: 50 }).eq("id", part)).error?.message).toBe("stock_direct_edit");
    // A new part always starts at zero, whatever is sent.
    const sneaky = await admin.from("parts").insert({ workshop_id: wsA, name: "Sneaky", selling_price: 1, stock_on_hand: 99 }).select("stock_on_hand").single();
    expect(Number(sneaky.data?.stock_on_hand)).toBe(0);
    expect(await stock(part)).toBe(0);
  });

  it("keeps the ledger append-only", async () => {
    const part = await newPart("Air filter");
    await stockA.client.rpc("receive_stock", { p_part: part, p_quantity: 5 });
    const [m] = await movements(part);
    expect(m).toMatchObject({ kind: "receipt", quantity: 5, balance_after: 5 });
    const { data: row } = await admin.from("stock_movements").select("id").eq("part_id", part).single();
    expect((await admin.from("stock_movements").update({ quantity: 50 }).eq("id", row!.id)).error?.message).toBe("stock_permanent");
    expect((await admin.from("stock_movements").delete().eq("id", row!.id)).error?.message).toBe("stock_permanent");
    const direct = await stockA.client.from("stock_movements").insert({ workshop_id: wsA, part_id: part, kind: "receipt", quantity: 9, balance_after: 9 } as never);
    expect(direct.error).not.toBeNull();
  });

  it("doesn't move stock when a part is estimated, approved or invoiced — only when it's used", async () => {
    const part = await newPart("Brake pads (front)");
    await stockA.client.rpc("receive_stock", { p_part: part, p_quantity: 10, p_unit_cost: 650, p_supplier: "Auto Parts Co", p_reference: "BILL-881" });
    const { job, line } = await approvedJobWithPart(part, 2);
    expect(await stock(part)).toBe(10);

    const used = await useLine(mechanicA.client, job, line, 2);
    expect(used.error?.message).toBe("Job card not found"); // not assigned to this job
    const byAdvisor = await useLine(advisorA.client, job, line, 2);
    expect(byAdvisor.error).toBeNull();
    expect(await stock(part)).toBe(8);
    expect((await movements(part)).at(-1)).toMatchObject({ kind: "consumption", quantity: -2, balance_after: 8, job_card_id: job, part_used_id: byAdvisor.data!.id });

    // Finishing and billing the job moves nothing more.
    for (const [action, from] of [
      ["request_assignment", "approved"],
      ["start_work", "awaiting_assignment"],
      ["finish_work", "in_progress"],
      ["pass_quality_check", "quality_check"],
    ]) {
      expect((await move(advisorA.client, job, action, from)).error).toBeNull();
    }
    await billJob(ownerA.client, job);
    expect(await stock(part)).toBe(8);
  });

  it("puts stock back when a part-used entry is removed", async () => {
    const part = await newPart("Spark plug");
    await stockA.client.rpc("receive_stock", { p_part: part, p_quantity: 4 });
    const { job, line } = await approvedJobWithPart(part, 4);
    const used = (await useLine(advisorA.client, job, line, 4)).data!;
    expect(await stock(part)).toBe(0);
    await advisorA.client.from("job_parts_used").update({ removed_at: new Date().toISOString() }).eq("id", used.id);
    expect(await stock(part)).toBe(4);
    expect((await movements(part)).at(-1)).toMatchObject({ kind: "return", quantity: 4, reason: expect.stringMatching(/^Removed from JC-\d{4}$/) });
  });

  it("lets stock go below zero rather than stop a mechanic, and ignores untracked parts", async () => {
    const part = await newPart("Wiper blade");
    const { job, line } = await approvedJobWithPart(part, 1);
    await useLine(advisorA.client, job, line, 1);
    expect(await stock(part)).toBe(-1);

    const loose = await newPart("Shop rag", { track_stock: false });
    const other = await approvedJobWithPart(loose, 3);
    await useLine(advisorA.client, other.job, other.line, 3);
    expect(await movements(loose)).toEqual([]);
    expect((await stockA.client.rpc("receive_stock", { p_part: loose, p_quantity: 1 })).error?.message).toBe("stock_not_tracked");
  });
});

describe("receiving and counting", () => {
  it("receives stock and takes the latest purchase price as the cost", async () => {
    const part = await newPart("Coolant 1L");
    expect((await stockA.client.rpc("receive_stock", { p_part: part, p_quantity: 0 })).error?.message).toBe("quantity_invalid");
    expect((await stockA.client.rpc("receive_stock", { p_part: part, p_quantity: 1.005 })).error?.message).toBe("quantity_invalid");
    expect((await stockA.client.rpc("receive_stock", { p_part: part, p_quantity: 12, p_unit_cost: 720, p_supplier: "Gulf Lubes" })).error).toBeNull();
    const { data } = await admin.from("parts").select("stock_on_hand, cost_price").eq("id", part).single();
    expect(data).toMatchObject({ stock_on_hand: 12, cost_price: 720 });
    const { data: log } = await admin.from("activity_logs").select("actor_id, metadata").eq("entity_id", part).eq("action", "stock.received").single();
    expect(log).toMatchObject({ actor_id: stockA.id, metadata: { quantity: 12, supplier: "Gulf Lubes" } });
  });

  it("corrects stock to a physical count, always with a reason", async () => {
    const part = await newPart("Fuse 10A");
    await stockA.client.rpc("receive_stock", { p_part: part, p_quantity: 20 });
    expect((await stockA.client.rpc("count_stock", { p_part: part, p_counted: 17, p_reason: " " })).error?.message).toBe("reason_required");
    expect((await stockA.client.rpc("count_stock", { p_part: part, p_counted: 17, p_reason: "Monthly count" })).error).toBeNull();
    expect((await movements(part)).at(-1)).toMatchObject({ kind: "adjustment", quantity: -3, balance_after: 17, reason: "Monthly count" });
    // Counting the same figure records the check but moves nothing.
    expect((await stockA.client.rpc("count_stock", { p_part: part, p_counted: 17, p_reason: "Spot check" })).data).toBeNull();
    expect(await movements(part)).toHaveLength(2);
  });
});

describe("low stock", () => {
  it("notifies stock managers once, when a part crosses its reorder level", async () => {
    const part = await newPart("Brake fluid", { reorder_level: 3 });
    await stockA.client.rpc("receive_stock", { p_part: part, p_quantity: 5 });
    const { job, line } = await approvedJobWithPart(part, 2);
    await useLine(advisorA.client, job, line, 2);
    const count = async (u: TestUser) =>
      (await u.client.from("notifications").select("id", { count: "exact", head: true }).eq("kind", "low_stock").like("link", `%${part}`)).count;
    expect(await count(stockA)).toBe(1);
    expect(await count(ownerA)).toBe(1);
    expect(await count(advisorA)).toBe(0);

    const again = await approvedJobWithPart(part, 1);
    await useLine(advisorA.client, again.job, again.line, 1);
    expect(await count(stockA)).toBe(1); // already low: no repeat
    const low = (await stockA.client.rpc("low_stock_parts", { ws: wsA })).data ?? [];
    expect(low.find((p) => p.id === part)).toMatchObject({ stock_on_hand: 2, reorder_level: 3 });
  });
});

describe("who can do what", () => {
  it("lets inventory managers and owners move stock; advisors only see the figure", async () => {
    const part = await newPart("Bulb H4");
    expect((await advisorA.client.rpc("receive_stock", { p_part: part, p_quantity: 1 })).error?.message).toBe("Part not found");
    expect((await advisorA.client.rpc("count_stock", { p_part: part, p_counted: 1, p_reason: "x" })).error?.message).toBe("Part not found");
    expect((await ownerA.client.rpc("receive_stock", { p_part: part, p_quantity: 2 })).error).toBeNull();
    const seen = await advisorA.client.from("parts").select("stock_on_hand").eq("id", part).single();
    expect(Number(seen.data?.stock_on_hand)).toBe(2);
    expect((await advisorA.client.from("stock_movements").select("id").eq("part_id", part)).data ?? []).toEqual([]);
    expect((await mechanicA.client.from("parts").select("id").eq("id", part)).data ?? []).toEqual([]);
  });

  it("keeps another workshop out", async () => {
    const part = await newPart("Battery 45Ah");
    await stockA.client.rpc("receive_stock", { p_part: part, p_quantity: 3 });
    expect((await ownerB.client.from("stock_movements").select("id").eq("part_id", part)).data ?? []).toEqual([]);
    expect((await ownerB.client.rpc("receive_stock", { p_part: part, p_quantity: 100 })).error?.message).toBe("Part not found");
    expect((await ownerB.client.rpc("low_stock_parts", { ws: wsA })).data ?? []).toEqual([]);
    expect(await stock(part)).toBe(3);
    void wsB;
  });
});
