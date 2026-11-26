import { beforeAll, describe, expect, it } from "vitest";
import { addMember, admin, createWorkshop, run, userClient, type Client, type TestUser } from "./helpers";
import { billJob, move, readyForDelivery } from "./workflow";

let ownerA: TestUser;
let advisorA: TestUser;
let mechanicA: TestUser;
let cashierA: TestUser;
let ownerB: TestUser;
let wsA: string;
let wsB: string;
let vehicleA: string;

const LINES = [
  { description: "Brake service (front axle)", unit_price: 2500, kind: "labour" as const },
  { description: "Front brake pads", unit_price: 6000, kind: "part" as const },
];

async function newJob(client: Client = advisorA.client) {
  const res = await client.rpc("create_job_card", { ws: wsA, p_vehicle: vehicleA, p_complaint: "Brakes squeal" });
  if (res.error) throw res.error;
  return res.data;
}

/** A job at Ready for delivery with an approved Rs 8,500 estimate. */
async function readyJob() {
  const job = await newJob();
  await readyForDelivery(advisorA.client, wsA, job, LINES);
  return job;
}

async function invoiceRow(id: string) {
  const { data } = await admin.from("invoices").select("*").eq("id", id).single();
  return data!;
}

beforeAll(async () => {
  [ownerA, advisorA, mechanicA, cashierA, ownerB] = await Promise.all([
    userClient("p6-owner-a"),
    userClient("p6-advisor-a"),
    userClient("p6-mechanic-a"),
    userClient("p6-cashier-a"),
    userClient("p6-owner-b"),
  ]);
  wsA = await createWorkshop(ownerA.client, `Alpha Billing ${run}`);
  wsB = await createWorkshop(ownerB.client, `Bravo Billing ${run}`);
  await addMember(ownerA.client, wsA, advisorA, "advisor");
  await addMember(ownerA.client, wsA, mechanicA, "mechanic");
  await addMember(ownerA.client, wsA, cashierA, "cashier");
  await ownerA.client.from("workshops").update({ tax_rate: 10, tax_label: "GST" }).eq("id", wsA);

  const c = await advisorA.client.from("customers").insert({ workshop_id: wsA, name: "Kamran Shah", phone: "0300 6000001" }).select("id").single();
  if (c.error) throw c.error;
  const v = await advisorA.client
    .from("vehicles")
    .insert({ workshop_id: wsA, customer_id: c.data.id, registration_number: "LEF-6001", make: "Honda", model: "Civic", year: 2020 })
    .select("id")
    .single();
  if (v.error) throw v.error;
  vehicleA = v.data.id;
});

describe("a void is audited, never hard-deleted (Phase 6 gate)", () => {
  it("refuses to delete an invoice for everyone, even with the service key", async () => {
    const job = await readyJob();
    const draft = (await cashierA.client.rpc("create_invoice", { p_job: job })).data!;
    const asOwner = await ownerA.client.from("invoices").delete().eq("id", draft);
    expect(asOwner.error).not.toBeNull();
    const asService = await admin.from("invoices").delete().eq("id", draft);
    expect(asService.error?.message).toBe("invoice_permanent");

    await cashierA.client.rpc("issue_invoice", { p_invoice: draft });
    expect((await admin.from("invoices").delete().eq("id", draft)).error?.message).toBe("invoice_permanent");
    expect(await invoiceRow(draft)).toBeTruthy();
  });

  it("keeps a voided invoice with its number, who voided it and why — and logs it", async () => {
    const job = await readyJob();
    const id = await billJob(cashierA.client, job);
    const number = (await invoiceRow(id)).invoice_number;

    expect((await cashierA.client.rpc("void_invoice", { p_invoice: id, p_reason: " " })).error?.message).toBe("reason_required");
    expect((await advisorA.client.rpc("void_invoice", { p_invoice: id, p_reason: "Wrong customer" })).error).not.toBeNull();
    expect((await cashierA.client.rpc("void_invoice", { p_invoice: id, p_reason: "Billed to the wrong customer" })).error).toBeNull();

    const row = await invoiceRow(id);
    expect(row).toMatchObject({ status: "void", invoice_number: number, voided_by: cashierA.id, void_reason: "Billed to the wrong customer" });
    expect(row.voided_at).toBeTruthy();
    const { data: log } = await admin.from("activity_logs").select("actor_id, metadata").eq("entity_id", id).eq("action", "invoice.voided").single();
    expect(log).toMatchObject({ actor_id: cashierA.id, metadata: { invoice_number: number, reason: "Billed to the wrong customer" } });

    // Void is final, and its number is never reused: the corrected invoice gets the next one.
    expect((await cashierA.client.rpc("void_invoice", { p_invoice: id, p_reason: "again" })).error?.message).toBe("invoice_void");
    const corrected = await billJob(cashierA.client, job);
    expect((await invoiceRow(corrected)).invoice_number).not.toBe(number);
  });

  it("won't void while money is held: refund first, then void", async () => {
    const job = await readyJob();
    const id = await billJob(cashierA.client, job);
    const paid = await cashierA.client.rpc("record_payment", { p_invoice: id, p_amount: 3000, p_method: "cash" });
    expect(paid.error).toBeNull();
    expect((await cashierA.client.rpc("void_invoice", { p_invoice: id, p_reason: "Mistake" })).error?.message).toBe("invoice_has_payments");

    expect((await cashierA.client.rpc("refund_payment", { p_payment: paid.data!, p_amount: 3000, p_method: "cash", p_reason: "Wrong job" })).error).toBeNull();
    expect((await cashierA.client.rpc("void_invoice", { p_invoice: id, p_reason: "Mistake" })).error).toBeNull();
  });
});

describe("creating and issuing invoices", () => {
  it("builds the draft from the approved lines, with the estimate's tax", async () => {
    const job = await readyJob();
    const id = (await cashierA.client.rpc("create_invoice", { p_job: job })).data!;
    const { data: items } = await cashierA.client.from("invoice_items").select("description, source, unit_price").eq("invoice_id", id).order("position");
    expect(items?.map((i) => [i.description, i.source])).toEqual([
      ["Brake service (front axle)", "approved_estimate"],
      ["Front brake pads", "approved_estimate"],
    ]);
    const row = await invoiceRow(id);
    expect(row).toMatchObject({ status: "draft", invoice_number: null, tax_rate: 10, subtotal: 8500, tax_total: 850, total: 9350, balance_due: 9350 });
  });

  it("numbers on issue, freezes the lines and keeps a copy of the customer and vehicle", async () => {
    const job = await readyJob();
    const id = (await cashierA.client.rpc("create_invoice", { p_job: job })).data!;
    const extra = await cashierA.client
      .from("invoice_items")
      .insert({ workshop_id: wsA, invoice_id: id, position: 5, kind: "other", description: "Shop supplies", unit_price: 200, source: "added" })
      .select("id")
      .single();
    expect(extra.error).toBeNull();
    expect((await invoiceRow(id)).total).toBe(9570);

    const issued = await cashierA.client.rpc("issue_invoice", { p_invoice: id });
    expect(issued.data).toMatch(/^INV-\d{4}$/);
    const row = await invoiceRow(id);
    expect(row).toMatchObject({ status: "issued", customer_name: "Kamran Shah", vehicle_registration: "LEF-6001", issued_by: cashierA.id });

    expect((await cashierA.client.from("invoice_items").update({ unit_price: 1 }).eq("id", extra.data!.id)).error?.message).toBe("invoice_locked");
    expect((await cashierA.client.from("invoice_items").delete().eq("id", extra.data!.id)).error?.message).toBe("invoice_locked");
    const add = await cashierA.client.from("invoice_items").insert({ workshop_id: wsA, invoice_id: id, kind: "other", description: "Late", unit_price: 1 });
    expect(add.error?.message).toBe("invoice_locked");
    expect((await cashierA.client.from("invoices").update({ notes: "changed" }).eq("id", id)).error?.message).toBe("invoice_locked");
    // Totals and money columns are never writable by clients, even on drafts.
    const draft = (await cashierA.client.rpc("create_invoice", { p_job: await readyJob() })).data!;
    expect((await cashierA.client.from("invoices").update({ total: 1 } as never).eq("id", draft)).error).not.toBeNull();
  });

  it("only bills finished work, once per job, and never an empty invoice", async () => {
    const early = await newJob();
    expect((await cashierA.client.rpc("create_invoice", { p_job: early })).error?.message).toBe("invoice_not_allowed");

    const job = await readyJob();
    const id = (await cashierA.client.rpc("create_invoice", { p_job: job })).data!;
    expect((await cashierA.client.rpc("create_invoice", { p_job: job })).error?.message).toBe("invoice_exists");
    await cashierA.client.from("invoice_items").delete().eq("invoice_id", id);
    expect((await cashierA.client.rpc("issue_invoice", { p_invoice: id })).error?.message).toBe("invoice_empty");
  });
});

describe("payments and refunds", () => {
  it("takes part payments, refuses overpayment and tells the advisor when it's paid in full", async () => {
    const job = await readyJob();
    const id = await billJob(cashierA.client, job); // Rs 9,350
    expect((await cashierA.client.rpc("record_payment", { p_invoice: id, p_amount: 5000, p_method: "jazzcash", p_reference: "TX-1" })).error).toBeNull();
    expect((await invoiceRow(id)).balance_due).toBe(4350);

    const over = await cashierA.client.rpc("record_payment", { p_invoice: id, p_amount: 5000, p_method: "cash" });
    expect(over.error?.message).toBe("overpayment");
    expect((await cashierA.client.rpc("record_payment", { p_invoice: id, p_amount: 0.001, p_method: "cash" })).error?.message).toBe("amount_invalid");

    expect((await cashierA.client.rpc("record_payment", { p_invoice: id, p_amount: 4350, p_method: "cash" })).error).toBeNull();
    expect(await invoiceRow(id)).toMatchObject({ amount_paid: 9350, balance_due: 0 });

    const { data: note } = await advisorA.client.from("notifications").select("title").eq("kind", "invoice_paid").order("created_at", { ascending: false }).limit(1);
    expect(note?.[0]?.title).toMatch(/paid in full$/);
  });

  it("keeps the ledger append-only, even for the service key", async () => {
    const job = await readyJob();
    const id = await billJob(cashierA.client, job);
    const p = (await cashierA.client.rpc("record_payment", { p_invoice: id, p_amount: 100, p_method: "cash" })).data!;
    expect((await cashierA.client.from("payments").update({ amount: 1 }).eq("id", p)).error).not.toBeNull();
    expect((await admin.from("payments").update({ amount: 1 }).eq("id", p)).error?.message).toBe("payment_permanent");
    expect((await admin.from("payments").delete().eq("id", p)).error?.message).toBe("payment_permanent");
    const direct = await cashierA.client.from("payments").insert({ workshop_id: wsA, invoice_id: id, amount: 1, method: "cash" });
    expect(direct.error).not.toBeNull();
  });

  it("refunds only what was paid, with a reason, and the invoice owes again", async () => {
    const job = await readyJob();
    const id = await billJob(cashierA.client, job);
    const p = (await cashierA.client.rpc("record_payment", { p_invoice: id, p_amount: 9350, p_method: "card" })).data!;

    expect((await cashierA.client.rpc("refund_payment", { p_payment: p, p_amount: 500, p_method: "cash", p_reason: "" })).error?.message).toBe("reason_required");
    expect((await cashierA.client.rpc("refund_payment", { p_payment: p, p_amount: 9351, p_method: "cash", p_reason: "Too much" })).error?.message).toBe("refund_too_large");
    const r = await cashierA.client.rpc("refund_payment", { p_payment: p, p_amount: 1350, p_method: "cash", p_reason: "Pads were cheaper than quoted" });
    expect(r.error).toBeNull();
    expect((await cashierA.client.rpc("refund_payment", { p_payment: r.data!, p_amount: 1, p_method: "cash", p_reason: "x" })).error?.message).toBe("refund_of_refund");
    expect((await cashierA.client.rpc("refund_payment", { p_payment: p, p_amount: 8001, p_method: "cash", p_reason: "More" })).error?.message).toBe("refund_too_large");

    expect(await invoiceRow(id)).toMatchObject({ status: "issued", amount_paid: 8000, balance_due: 1350 });
    // Only owners and accountants give money back.
    const asAdvisor = await advisorA.client.rpc("refund_payment", { p_payment: p, p_amount: 1, p_method: "cash", p_reason: "x" });
    expect(asAdvisor.error).not.toBeNull();
  });

  it("sums today's invoiced and collected separately", async () => {
    const before = (await cashierA.client.rpc("billing_summary", { ws: wsA, p_from: new Date(Date.now() - 3600e3).toISOString(), p_to: new Date(Date.now() + 3600e3).toISOString() })).data![0];
    const id = await billJob(cashierA.client, await readyJob());
    await cashierA.client.rpc("record_payment", { p_invoice: id, p_amount: 1000, p_method: "cash" });
    const after = (await cashierA.client.rpc("billing_summary", { ws: wsA, p_from: new Date(Date.now() - 3600e3).toISOString(), p_to: new Date(Date.now() + 3600e3).toISOString() })).data![0];
    expect(after.invoiced - before.invoiced).toBe(9350);
    expect(after.collected - before.collected).toBe(1000);
    expect(after.outstanding - before.outstanding).toBe(8350);
  });
});

describe("billing and the job's status", () => {
  it("won't deliver without an issued invoice, but lets the car go with a balance", async () => {
    const job = await readyJob();
    expect((await move(advisorA.client, job, "deliver", "ready_for_delivery")).error?.message).toBe("invoice_required");
    const draft = (await cashierA.client.rpc("create_invoice", { p_job: job })).data!;
    expect((await move(advisorA.client, job, "deliver", "ready_for_delivery")).error?.message).toBe("invoice_required");
    await cashierA.client.rpc("issue_invoice", { p_invoice: draft });
    expect((await move(advisorA.client, job, "deliver", "ready_for_delivery")).error).toBeNull();
    expect((await invoiceRow(draft)).balance_due).toBe(9350);
  });

  it("won't cancel a job with a live invoice", async () => {
    const job = await readyJob();
    const id = await billJob(cashierA.client, job);
    expect((await move(advisorA.client, job, "cancel", "ready_for_delivery", "Customer left")).error?.message).toBe("invoice_open");
    await cashierA.client.rpc("void_invoice", { p_invoice: id, p_reason: "Job cancelled" });
    expect((await move(advisorA.client, job, "cancel", "ready_for_delivery", "Customer left")).error).toBeNull();
  });
});

describe("who sees billing", () => {
  it("lets advisors read invoices but not make them; mechanics see nothing", async () => {
    const job = await readyJob();
    const id = await billJob(cashierA.client, job);
    expect((await advisorA.client.from("invoices").select("id").eq("id", id)).data).toHaveLength(1);
    expect((await advisorA.client.rpc("create_invoice", { p_job: await readyJob() })).error).not.toBeNull();
    expect((await advisorA.client.rpc("record_payment", { p_invoice: id, p_amount: 10, p_method: "cash" })).error).not.toBeNull();
    expect((await mechanicA.client.from("invoices").select("id").eq("id", id)).data ?? []).toEqual([]);
    expect((await mechanicA.client.from("payments").select("id").eq("invoice_id", id)).data ?? []).toEqual([]);
  });

  it("keeps another workshop out entirely", async () => {
    const job = await readyJob();
    const id = await billJob(cashierA.client, job);
    await cashierA.client.rpc("record_payment", { p_invoice: id, p_amount: 10, p_method: "cash" });
    expect((await ownerB.client.from("invoices").select("id").eq("id", id)).data ?? []).toEqual([]);
    expect((await ownerB.client.from("payments").select("id").eq("invoice_id", id)).data ?? []).toEqual([]);
    expect((await ownerB.client.from("invoice_items").select("id").eq("invoice_id", id)).data ?? []).toEqual([]);
    expect((await ownerB.client.rpc("record_payment", { p_invoice: id, p_amount: 10, p_method: "cash" })).error?.message).toBe("Invoice not found");
    expect((await ownerB.client.rpc("void_invoice", { p_invoice: id, p_reason: "x" })).error?.message).toBe("Invoice not found");
    expect((await ownerB.client.rpc("create_invoice", { p_job: job })).error?.message).toBe("Job card not found");
    const summary = (await ownerB.client.rpc("billing_summary", { ws: wsA, p_from: "2000-01-01", p_to: "2100-01-01" })).data![0];
    expect(summary).toMatchObject({ invoiced: 0, collected: 0, outstanding: 0 });
    void wsB;
  });
});
