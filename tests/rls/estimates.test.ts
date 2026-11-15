import { beforeAll, describe, expect, it } from "vitest";
import { addMember, admin, anonClient, createWorkshop, run, userClient, type Client, type TestUser } from "./helpers";
import { approveAll, completeInspection, draftEstimate, itemIds, sendEstimate } from "./workflow";

let ownerA: TestUser;
let advisorA: TestUser;
let mechanicA: TestUser;
let cashierA: TestUser;
let ownerB: TestUser;
let wsA: string;
let wsB: string;
let vehicleA: string;

async function newJob(client: Client = advisorA.client) {
  const res = await client.rpc("create_job_card", { ws: wsA, p_vehicle: vehicleA, p_complaint: "Brakes squeal" });
  if (res.error) throw res.error;
  return res.data;
}

async function jobStatus(job: string) {
  const { data } = await admin.from("job_cards").select("status").eq("id", job).single();
  return data?.status;
}

async function estimateRow(id: string) {
  const { data } = await admin.from("estimates").select("status, version, total").eq("id", id).single();
  return data;
}

async function lines(estimate: string) {
  const { data } = await admin
    .from("estimate_items")
    .select("id, description, approval_status")
    .eq("estimate_id", estimate)
    .order("position");
  return data ?? [];
}

beforeAll(async () => {
  [ownerA, advisorA, mechanicA, cashierA, ownerB] = await Promise.all([
    userClient("p4-owner-a"),
    userClient("p4-advisor-a"),
    userClient("p4-mechanic-a"),
    userClient("p4-cashier-a"),
    userClient("p4-owner-b"),
  ]);
  wsA = await createWorkshop(ownerA.client, `Alpha Estimates ${run}`);
  wsB = await createWorkshop(ownerB.client, `Bravo Estimates ${run}`);
  await addMember(ownerA.client, wsA, advisorA, "advisor");
  await addMember(ownerA.client, wsA, mechanicA, "mechanic");
  await addMember(ownerA.client, wsA, cashierA, "cashier");

  const c = await advisorA.client
    .from("customers")
    .insert({ workshop_id: wsA, name: "Nadia Hussain", phone: "0300 4000001", address: "House 9, Gulberg" })
    .select("id")
    .single();
  if (c.error) throw c.error;
  const v = await advisorA.client
    .from("vehicles")
    .insert({ workshop_id: wsA, customer_id: c.data.id, registration_number: "LEB-4001", make: "Toyota", model: "Yaris" })
    .select("id")
    .single();
  if (v.error) throw v.error;
  vehicleA = v.data.id;
});

describe("a revised estimate needs fresh approval (Phase 4 gate)", () => {
  it("never carries an approval over to the next version", async () => {
    const job = await newJob();
    await completeInspection(advisorA.client, job);
    const v1 = await draftEstimate(advisorA.client, wsA, job, [
      { description: "Front brake pads", unit_price: 6000 },
      { description: "Brake fluid flush", unit_price: 2500 },
    ]);
    const link1 = await sendEstimate(advisorA.client, v1);
    expect((await approveAll(link1, await itemIds(advisorA.client, v1))).data).toBe("approved");
    expect(await jobStatus(job)).toBe("approved");

    // Customer asks for more work before it starts: revision required, with a reason.
    expect((await advisorA.client.rpc("create_estimate", { p_job: job })).error?.message).toBe("reason_required");
    const v2 = await draftEstimate(advisorA.client, wsA, job, [{ description: "Rear brake shoes", unit_price: 5000 }], "Customer asked to add rear brakes");
    expect(await jobStatus(job)).toBe("awaiting_estimate");
    expect((await estimateRow(v2))?.version).toBe(2);

    const v2Lines = await lines(v2);
    expect(v2Lines.map((l) => l.description)).toEqual(["Front brake pads", "Brake fluid flush", "Rear brake shoes"]);
    expect(v2Lines.every((l) => l.approval_status === "pending")).toBe(true);

    const link2 = await sendEstimate(advisorA.client, v2);
    expect((await estimateRow(v1))?.status).toBe("superseded");
    expect(await jobStatus(job)).toBe("awaiting_approval");

    // The old link is dead: it can't approve the new version or even be viewed.
    expect((await approveAll(link1, await itemIds(advisorA.client, v1))).error?.message).toBe("link_invalid");
    expect((await anonClient().rpc("get_estimate_for_customer", { p_token: link1 })).data).toBeNull();

    // Fresh decision on v2: only the new line. Lines approved in v1 are declined here.
    const newLine = v2Lines.find((l) => l.description === "Rear brake shoes")!.id;
    expect((await approveAll(link2, [newLine])).data).toBe("partially_approved");
    const after = await lines(v2);
    expect(after.filter((l) => l.approval_status === "approved").map((l) => l.description)).toEqual(["Rear brake shoes"]);
    expect(await jobStatus(job)).toBe("approved");

    const { data: decisions } = await admin.from("estimate_decisions").select("version, decision").in("estimate_id", [v1, v2]).order("version");
    expect(decisions).toEqual([
      { version: 1, decision: "approved" },
      { version: 2, decision: "partially_approved" },
    ]);
  });

  it("freezes a sent version: prices, lines and terms can't change", async () => {
    const job = await newJob();
    await completeInspection(advisorA.client, job);
    const est = await draftEstimate(advisorA.client, wsA, job);
    await sendEstimate(advisorA.client, est);
    const [line] = await itemIds(advisorA.client, est);

    expect((await ownerA.client.from("estimate_items").update({ unit_price: 1 }).eq("id", line)).error?.message).toBe("estimate_locked");
    expect((await ownerA.client.from("estimate_items").delete().eq("id", line)).error?.message).toBe("estimate_locked");
    const added = await ownerA.client
      .from("estimate_items")
      .insert({ workshop_id: wsA, estimate_id: est, kind: "other", description: "Sneaky extra", unit_price: 999 });
    expect(added.error?.message).toBe("estimate_locked");
    expect((await ownerA.client.from("estimates").update({ terms: "New terms" }).eq("id", est)).error?.message).toBe("estimate_locked");
  });

  it("doesn't let staff mark lines approved themselves", async () => {
    const job = await newJob();
    await completeInspection(advisorA.client, job);
    const est = await draftEstimate(advisorA.client, wsA, job);
    const res = await ownerA.client.from("estimate_items").update({ approval_status: "approved" } as never).eq("estimate_id", est);
    expect(res.error).not.toBeNull();
  });

  it("withdraws the waiting version when a revision starts, killing its link", async () => {
    const job = await newJob();
    await completeInspection(advisorA.client, job);
    const v1 = await draftEstimate(advisorA.client, wsA, job);
    const link = await sendEstimate(advisorA.client, v1);
    await draftEstimate(advisorA.client, wsA, job, [], "Customer wants a cheaper option");
    expect((await estimateRow(v1))?.status).toBe("withdrawn");
    expect(await jobStatus(job)).toBe("awaiting_estimate");
    expect((await approveAll(link, await itemIds(advisorA.client, v1))).error?.message).toBe("link_invalid");
  });
});

describe("customer decisions", () => {
  it("accepts a link only once", async () => {
    const job = await newJob();
    await completeInspection(advisorA.client, job);
    const est = await draftEstimate(advisorA.client, wsA, job);
    const link = await sendEstimate(advisorA.client, est);
    const ids = await itemIds(advisorA.client, est);
    expect((await approveAll(link, ids)).error).toBeNull();
    expect((await approveAll(link, ids)).error?.message).toBe("already_decided");
  });

  it("sends the job back for a new estimate when everything is declined", async () => {
    const job = await newJob();
    await completeInspection(advisorA.client, job);
    const est = await draftEstimate(advisorA.client, wsA, job);
    const link = await sendEstimate(advisorA.client, est);
    expect((await approveAll(link, [])).data).toBe("rejected");
    expect(await jobStatus(job)).toBe("awaiting_estimate");
    const { data } = await admin.from("job_status_history").select("action").eq("job_card_id", job).order("id", { ascending: false }).limit(1);
    expect(data?.[0]?.action).toBe("customer_declined");
  });

  it("requires the customer's name and refuses lines from elsewhere", async () => {
    const job = await newJob();
    await completeInspection(advisorA.client, job);
    const est = await draftEstimate(advisorA.client, wsA, job);
    const link = await sendEstimate(advisorA.client, est);
    const anon = anonClient();
    expect((await anon.rpc("respond_to_estimate", { p_token: link, p_approved: [], p_customer_name: " " })).error?.message).toBe("name_required");
    const foreign = await anon.rpc("respond_to_estimate", {
      p_token: link,
      p_approved: ["00000000-0000-4000-8000-000000000000"],
      p_customer_name: "Nadia",
    });
    expect(foreign.error?.message).toBe("unknown_item");
    expect((await anon.rpc("respond_to_estimate", { p_token: "not-a-real-token", p_approved: [], p_customer_name: "Nadia" })).error?.message).toBe("link_invalid");
  });

  it("lets staff record a decision given in person, attributed to them", async () => {
    const job = await newJob();
    await completeInspection(advisorA.client, job);
    const est = await draftEstimate(advisorA.client, wsA, job, [
      { description: "Engine oil", unit_price: 4000 },
      { description: "Air filter", unit_price: 1200 },
    ]);
    await sendEstimate(advisorA.client, est);
    const [oil] = await itemIds(advisorA.client, est);
    const res = await advisorA.client.rpc("record_estimate_decision", {
      p_estimate: est,
      p_approved: [oil],
      p_method: "in_person",
      p_note: "Customer will bring own air filter",
    });
    expect(res.data).toBe("partially_approved");
    const { data } = await admin.from("estimate_decisions").select("method, recorded_by, customer_name, approved_total").eq("estimate_id", est).single();
    expect(data).toMatchObject({ method: "in_person", recorded_by: advisorA.id, customer_name: "Nadia Hussain" });
    expect(Number(data?.approved_total)).toBe(4000);
    expect((await mechanicA.client.rpc("record_estimate_decision", { p_estimate: est, p_approved: [], p_method: "phone" })).error).not.toBeNull();
  });

  it("notifies the service advisor and owners, privately", async () => {
    const job = await newJob();
    await completeInspection(advisorA.client, job);
    const est = await draftEstimate(advisorA.client, wsA, job);
    const link = await sendEstimate(advisorA.client, est);
    await approveAll(link, await itemIds(advisorA.client, est));

    const forAdvisor = await advisorA.client.from("notifications").select("id, title, link").eq("link", `/jobs/${job}`);
    const forOwner = await ownerA.client.from("notifications").select("id").eq("link", `/jobs/${job}`);
    const forMechanic = await mechanicA.client.from("notifications").select("id").eq("link", `/jobs/${job}`);
    expect(forAdvisor.data).toHaveLength(1);
    expect(forAdvisor.data?.[0].title).toMatch(/estimate approved/);
    expect(forOwner.data).toHaveLength(1);
    expect(forMechanic.data).toEqual([]);

    // Staff recording a decision themselves aren't notified about their own action.
    const job2 = await newJob();
    await completeInspection(advisorA.client, job2);
    const est2 = await draftEstimate(advisorA.client, wsA, job2);
    await sendEstimate(advisorA.client, est2);
    await ownerA.client.rpc("record_estimate_decision", { p_estimate: est2, p_approved: [], p_method: "phone" });
    expect((await ownerA.client.from("notifications").select("id").eq("link", `/jobs/${job2}`)).data).toEqual([]);
    expect((await advisorA.client.from("notifications").select("id").eq("link", `/jobs/${job2}`)).data).toHaveLength(1);

    const mine = forAdvisor.data![0].id;
    expect((await ownerA.client.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", mine).select("id")).data).toEqual([]);
    expect((await advisorA.client.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", mine).select("id")).data).toHaveLength(1);
  });
});

describe("estimate rules", () => {
  it("computes totals in the database with line discounts and tax on taxable lines only", async () => {
    await ownerA.client.from("workshops").update({ tax_rate: 17 }).eq("id", wsA);
    const job = await newJob();
    await completeInspection(advisorA.client, job);
    const est = await draftEstimate(advisorA.client, wsA, job, []);
    const res = await advisorA.client.from("estimate_items").insert([
      { workshop_id: wsA, estimate_id: est, kind: "part", description: "Shock absorber", quantity: 2, unit_price: 1000, discount: 100, taxable: true },
      { workshop_id: wsA, estimate_id: est, kind: "labour", description: "Fitting", quantity: 1, unit_price: 500, discount: 0, taxable: false },
    ]);
    expect(res.error).toBeNull();
    const { data } = await admin.from("estimates").select("subtotal, discount_total, tax_rate, tax_total, total").eq("id", est).single();
    expect(Object.fromEntries(Object.entries(data!).map(([k, v]) => [k, Number(v)]))).toEqual({
      subtotal: 2500,
      discount_total: 100,
      tax_rate: 17,
      tax_total: 323, // 17% of (2000 − 100)
      total: 2723,
    });
    await ownerA.client.from("workshops").update({ tax_rate: 0 }).eq("id", wsA);
  });

  it("allows one draft at a time, only after inspection, and never sends an empty estimate", async () => {
    const job = await newJob();
    expect((await advisorA.client.rpc("create_estimate", { p_job: job })).error?.message).toBe("estimate_not_allowed");
    await completeInspection(advisorA.client, job);
    const est = await draftEstimate(advisorA.client, wsA, job, []);
    expect((await advisorA.client.rpc("create_estimate", { p_job: job })).error?.message).toBe("draft_exists");
    expect((await advisorA.client.rpc("send_estimate", { p_estimate: est })).error?.message).toBe("estimate_empty");
  });
});

describe("inspections", () => {
  it("creates all 13 categories, moves the job on completion, then locks", async () => {
    const job = await newJob();
    const insp = await advisorA.client.rpc("start_inspection", { p_job: job });
    expect(insp.error).toBeNull();
    const { data: items } = await advisorA.client.from("job_inspection_items").select("id, category").eq("inspection_id", insp.data!);
    expect(items).toHaveLength(13);

    const brakes = items!.find((i) => i.category === "brakes")!.id;
    const upd = await advisorA.client.from("job_inspection_items").update({ outcome: "requires_repair", notes: "Pads at 2 mm" }).eq("id", brakes).select("updated_by");
    expect(upd.data?.[0]?.updated_by).toBe(advisorA.id);
    expect((await mechanicA.client.from("job_inspection_items").update({ outcome: "normal" }).eq("id", brakes).select("id")).data ?? []).toEqual([]);

    expect((await advisorA.client.rpc("complete_inspection", { p_job: job, p_summary: "Brakes worn" })).error).toBeNull();
    expect(await jobStatus(job)).toBe("awaiting_estimate");
    expect((await advisorA.client.from("job_inspection_items").update({ outcome: "normal" }).eq("id", brakes)).error?.message).toBe("inspection_completed");
    expect((await advisorA.client.rpc("complete_inspection", { p_job: job })).error?.message).toBe("inspection_completed");
  });
});

describe("the customer's approval page", () => {
  it("shows the estimate and findings, but none of the customer's contact details", async () => {
    const job = await newJob();
    const insp = await advisorA.client.rpc("start_inspection", { p_job: job });
    await advisorA.client.from("job_inspection_items").update({ outcome: "needs_attention", notes: "Tyre tread low" }).eq("inspection_id", insp.data!).eq("category", "tyres");
    await advisorA.client.rpc("complete_inspection", { p_job: job });
    const est = await draftEstimate(advisorA.client, wsA, job);
    const link = await sendEstimate(advisorA.client, est);

    const { data } = await anonClient().rpc("get_estimate_for_customer", { p_token: link });
    const page = data as { customer_first_name: string; items: unknown[]; findings: { notes: string }[]; estimate: { status: string } };
    expect(page.customer_first_name).toBe("Nadia");
    expect(page.items).toHaveLength(1);
    expect(page.findings.map((f) => f.notes)).toEqual(["Tyre tread low"]);
    expect(page.estimate.status).toBe("sent");
    const text = JSON.stringify(data);
    for (const secret of ["4000001", "Gulberg", "Hussain", "cost_price"]) expect(text).not.toContain(secret);
  });

  it("gives signed-out visitors no direct table access", async () => {
    const anon = anonClient();
    for (const table of ["estimates", "estimate_items", "estimate_decisions", "job_inspections"] as const) {
      const res = await anon.from(table).select("id").limit(1);
      expect(res.data ?? [], table).toEqual([]);
    }
  });
});

describe("catalogues", () => {
  it("lets the owner manage labour and parts, staff read them, and keeps them per workshop", async () => {
    const labour = await ownerA.client.from("labour_items").insert({ workshop_id: wsA, name: "Oil change", default_price: 1500, estimated_minutes: 30 }).select("id").single();
    expect(labour.error).toBeNull();
    const part = await ownerA.client.from("parts").insert({ workshop_id: wsA, name: "Oil filter", selling_price: 900, cost_price: 600 }).select("id").single();
    expect(part.error).toBeNull();

    expect((await advisorA.client.from("labour_items").insert({ workshop_id: wsA, name: "Advisor price" })).error).not.toBeNull();
    expect((await advisorA.client.from("labour_items").select("name").eq("workshop_id", wsA)).data?.map((l) => l.name)).toContain("Oil change");
    expect((await cashierA.client.from("parts").select("id").eq("id", part.data!.id)).data).toHaveLength(1);
    expect((await mechanicA.client.from("parts").select("id").eq("id", part.data!.id)).data).toEqual([]);
    expect((await ownerB.client.from("labour_items").select("id").eq("id", labour.data!.id)).data).toEqual([]);
    expect((await ownerA.client.from("labour_items").insert({ workshop_id: wsA, name: " oil CHANGE " })).error).not.toBeNull();
  });
});

describe("tenant isolation for inspections and estimates", () => {
  it("keeps another workshop out entirely", async () => {
    const job = await newJob();
    await completeInspection(advisorA.client, job);
    const est = await draftEstimate(advisorA.client, wsA, job);
    await sendEstimate(advisorA.client, est);

    const reads = await Promise.all([
      ownerB.client.from("estimates").select("id").eq("id", est),
      ownerB.client.from("estimate_items").select("id").eq("estimate_id", est),
      ownerB.client.from("job_inspections").select("id").eq("job_card_id", job),
    ]);
    for (const r of reads) expect(r.data).toEqual([]);
    expect((await ownerB.client.rpc("create_estimate", { p_job: job, p_reason: "x" })).error?.message).toBe("Job card not found");
    expect((await ownerB.client.rpc("start_inspection", { p_job: job })).error?.message).toBe("Job card not found");
    expect((await ownerB.client.rpc("record_estimate_decision", { p_estimate: est, p_approved: [], p_method: "phone" })).error?.message).toBe("Estimate not found");
    expect((await ownerB.client.rpc("renew_estimate_link", { p_estimate: est })).error?.message).toBe("Estimate not found");
    const insert = await ownerB.client.from("estimate_items").insert({ workshop_id: wsB, estimate_id: est, kind: "other", description: "x", unit_price: 1 });
    expect(insert.error).not.toBeNull();
  });
});
