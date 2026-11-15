import { beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/database.types";
import { addMember, admin, createWorkshop, run, userClient, type Client, type TestUser } from "./helpers";

type JobStatus = Database["public"]["Enums"]["job_status"];

let ownerA: TestUser;
let advisorA: TestUser;
let mechanicA: TestUser;
let cashierA: TestUser;
let ownerB: TestUser;
let wsA: string;
let wsB: string;
let vehicleA: string;
let vehicleB: string;

async function addCustomerAndVehicle(client: Client, ws: string, phone: string, plate: string) {
  const c = await client.from("customers").insert({ workshop_id: ws, name: `Owner ${plate}`, phone }).select("id").single();
  if (c.error) throw c.error;
  const v = await client
    .from("vehicles")
    .insert({ workshop_id: ws, customer_id: c.data.id, registration_number: plate, make: "Suzuki", model: "Cultus" })
    .select("id")
    .single();
  if (v.error) throw v.error;
  return v.data.id;
}

function openJob(
  client: Client,
  ws: string,
  vehicle: string,
  extra: Partial<Database["public"]["Functions"]["create_job_card"]["Args"]> = {},
) {
  return client.rpc("create_job_card", { ws, p_vehicle: vehicle, p_complaint: "Engine noise when cold", ...extra });
}

async function mustOpenJob(client: Client, ws: string, vehicle: string, extra = {}) {
  const res = await openJob(client, ws, vehicle, extra);
  if (res.error) throw res.error;
  return res.data;
}

function move(client: Client, job: string, action: string, expected: JobStatus, reason?: string) {
  return client.rpc("change_job_status", { p_job: job, p_action: action, p_expected_status: expected, p_reason: reason });
}

async function history(job: string) {
  const { data } = await admin
    .from("job_status_history")
    .select("from_status, to_status, action, reason, changed_by, changed_at")
    .eq("job_card_id", job)
    .order("id");
  return data ?? [];
}

beforeAll(async () => {
  [ownerA, advisorA, mechanicA, cashierA, ownerB] = await Promise.all([
    userClient("p3-owner-a"),
    userClient("p3-advisor-a"),
    userClient("p3-mechanic-a"),
    userClient("p3-cashier-a"),
    userClient("p3-owner-b"),
  ]);
  wsA = await createWorkshop(ownerA.client, `Alpha Jobs ${run}`);
  wsB = await createWorkshop(ownerB.client, `Bravo Jobs ${run}`);
  await addMember(ownerA.client, wsA, advisorA, "advisor");
  await addMember(ownerA.client, wsA, mechanicA, "mechanic");
  await addMember(ownerA.client, wsA, cashierA, "cashier");
  vehicleA = await addCustomerAndVehicle(advisorA.client, wsA, "0300 3000001", "LEC-3001");
  vehicleB = await addCustomerAndVehicle(ownerB.client, wsB, "0300 3000002", "LEC-3002");
});

describe("every status change is timestamped (Phase 3 gate)", () => {
  it("records check-in as the first timeline entry, with mileage linked to the job", async () => {
    const job = await mustOpenJob(advisorA.client, wsA, vehicleA, { p_mileage: 42000 });
    const { data } = await advisorA.client.from("job_cards").select("job_number, status").eq("id", job).single();
    expect(data).toEqual({ job_number: "JC-0001", status: "awaiting_inspection" });

    const h = await history(job);
    expect(h).toHaveLength(1);
    expect(h[0]).toMatchObject({ from_status: null, to_status: "awaiting_inspection", action: "checked_in", changed_by: advisorA.id });
    expect(h[0].changed_at).toBeTruthy();

    const reading = await admin.from("vehicle_mileage_readings").select("reading, source").eq("job_card_id", job).single();
    expect(reading.data).toEqual({ reading: 42000, source: "job" });
  });

  it("writes exactly one ordered history row for every move from check-in to delivery", async () => {
    const job = await mustOpenJob(advisorA.client, wsA, vehicleA, { p_as_draft: true });
    const path: [string, JobStatus][] = [
      ["check_in", "draft"],
      ["complete_inspection", "awaiting_inspection"],
      ["send_estimate", "awaiting_estimate"],
      ["record_approval", "awaiting_approval"],
      ["request_assignment", "approved"],
      ["start_work", "awaiting_assignment"],
      ["finish_work", "in_progress"],
      ["pass_quality_check", "quality_check"],
      ["deliver", "ready_for_delivery"],
    ];
    for (const [action, from] of path) {
      const res = await move(advisorA.client, job, action, from);
      expect(res.error, action).toBeNull();
    }

    const h = await history(job);
    expect(h.map((r) => r.action)).toEqual(["created_as_draft", ...path.map(([a]) => a)]);
    expect(h.slice(1).map((r) => r.from_status)).toEqual(path.map(([, from]) => from));
    expect(h.at(-1)?.to_status).toBe("delivered");
    for (const r of h) expect(r.changed_by).toBe(advisorA.id);
    const times = h.map((r) => new Date(r.changed_at).getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times);

    const { data } = await advisorA.client.from("job_cards").select("status, delivered_at").eq("id", job).single();
    expect(data?.status).toBe("delivered");
    expect(data?.delivered_at).toBeTruthy();
  });

  it("refuses any status change that bypasses change_job_status()", async () => {
    const job = await mustOpenJob(advisorA.client, wsA, vehicleA);
    const direct = await ownerA.client.from("job_cards").update({ status: "delivered" }).eq("id", job);
    expect(direct.error).not.toBeNull();
    expect(await history(job)).toHaveLength(1);
  });

  it("keeps the history append-only", async () => {
    const job = await mustOpenJob(advisorA.client, wsA, vehicleA);
    const edit = await ownerA.client.from("job_status_history").update({ reason: "rewritten" }).eq("job_card_id", job);
    const del = await ownerA.client.from("job_status_history").delete().eq("job_card_id", job);
    const forge = await ownerA.client
      .from("job_status_history")
      .insert({ workshop_id: wsA, job_card_id: job, to_status: "delivered", action: "forged" });
    expect(edit.error).not.toBeNull();
    expect(del.error).not.toBeNull();
    expect(forge.error).not.toBeNull();
    expect(await history(job)).toHaveLength(1);
  });
});

describe("status rules", () => {
  it("only allows moves defined for the current status", async () => {
    const job = await mustOpenJob(advisorA.client, wsA, vehicleA);
    const res = await move(advisorA.client, job, "deliver", "awaiting_inspection");
    expect(res.error?.message).toBe("invalid_transition");
  });

  it("requires a reason to skip inspection, hold or cancel, and records it", async () => {
    const job = await mustOpenJob(advisorA.client, wsA, vehicleA);
    expect((await move(advisorA.client, job, "skip_inspection", "awaiting_inspection")).error?.message).toBe("reason_required");
    expect((await move(advisorA.client, job, "skip_inspection", "awaiting_inspection", "Oil change at fixed price")).error).toBeNull();
    expect((await move(advisorA.client, job, "put_on_hold", "awaiting_estimate", "  ")).error?.message).toBe("reason_required");
    expect((await move(advisorA.client, job, "cancel", "awaiting_estimate")).error?.message).toBe("reason_required");

    const h = await history(job);
    expect(h.at(-1)).toMatchObject({ action: "skip_inspection", reason: "Oil change at fixed price" });
  });

  it("resumes a held job to the status it was in", async () => {
    const job = await mustOpenJob(advisorA.client, wsA, vehicleA);
    for (const [a, s] of [
      ["complete_inspection", "awaiting_inspection"],
      ["send_estimate", "awaiting_estimate"],
      ["record_approval", "awaiting_approval"],
      ["request_assignment", "approved"],
      ["start_work", "awaiting_assignment"],
    ] as [string, JobStatus][]) {
      await move(advisorA.client, job, a, s);
    }
    expect((await move(advisorA.client, job, "put_on_hold", "in_progress", "Waiting for parts")).data).toBe("on_hold");
    expect((await move(advisorA.client, job, "resume", "on_hold")).data).toBe("in_progress");
    const { data } = await advisorA.client.from("job_cards").select("on_hold_from").eq("id", job).single();
    expect(data?.on_hold_from).toBeNull();
  });

  it("lets only one of two simultaneous clicks through", async () => {
    const job = await mustOpenJob(advisorA.client, wsA, vehicleA);
    const [a, b] = await Promise.all([
      move(advisorA.client, job, "complete_inspection", "awaiting_inspection"),
      move(ownerA.client, job, "complete_inspection", "awaiting_inspection"),
    ]);
    expect([a.error, b.error].filter((e) => e === null)).toHaveLength(1);
    expect([a.error?.message, b.error?.message]).toContain("status_changed");
    expect(await history(job)).toHaveLength(2);
  });

  it("locks delivered and cancelled jobs", async () => {
    const job = await mustOpenJob(advisorA.client, wsA, vehicleA);
    expect((await move(advisorA.client, job, "cancel", "awaiting_inspection", "Customer left")).error).toBeNull();
    const edit = await advisorA.client.from("job_cards").update({ complaint: "Changed later" }).eq("id", job);
    expect(edit.error?.message).toBe("job_closed");
    expect((await move(advisorA.client, job, "check_in", "cancelled")).error?.message).toBe("invalid_transition");
  });
});

describe("opening job cards", () => {
  it("is atomic: a refused mileage reading leaves no job behind", async () => {
    const before = await admin.from("job_cards").select("id", { count: "exact", head: true }).eq("vehicle_id", vehicleA);
    const res = await openJob(advisorA.client, wsA, vehicleA, { p_mileage: 100 });
    expect(res.error?.message).toBe("mileage_decrease");
    const after = await admin.from("job_cards").select("id", { count: "exact", head: true }).eq("vehicle_id", vehicleA);
    expect(after.count).toBe(before.count);
    const withNote = await openJob(advisorA.client, wsA, vehicleA, { p_mileage: 100, p_mileage_note: "Odometer replaced" });
    expect(withNote.error).toBeNull();
  });

  it("numbers jobs with the workshop's current prefix", async () => {
    await ownerA.client.from("workshops").update({ job_card_prefix: "LHR" }).eq("id", wsA);
    const job = await mustOpenJob(advisorA.client, wsA, vehicleA);
    const { data } = await advisorA.client.from("job_cards").select("job_number").eq("id", job).single();
    expect(data?.job_number).toMatch(/^LHR-\d{4}$/);
    await ownerA.client.from("workshops").update({ job_card_prefix: "JC" }).eq("id", wsA);
  });

  it("only accepts a service advisor from the same workshop", async () => {
    const res = await openJob(advisorA.client, wsA, vehicleA, { p_advisor: ownerB.id });
    expect(res.error).not.toBeNull();
  });
});

describe("roles", () => {
  it("keeps mechanics out until assignment ships", async () => {
    expect((await openJob(mechanicA.client, wsA, vehicleA)).error).not.toBeNull();
    const read = await mechanicA.client.from("job_cards").select("id").eq("workshop_id", wsA);
    expect(read.data).toEqual([]);
  });

  it("lets the cashier read job cards but not move them", async () => {
    const job = await mustOpenJob(advisorA.client, wsA, vehicleA);
    const read = await cashierA.client.from("job_cards").select("id").eq("id", job);
    expect(read.data).toHaveLength(1);
    const res = await move(cashierA.client, job, "complete_inspection", "awaiting_inspection");
    expect(res.error).not.toBeNull();
  });
});

describe("tenant isolation for job cards", () => {
  let jobA: string;
  beforeAll(async () => {
    jobA = await mustOpenJob(advisorA.client, wsA, vehicleA);
    const note = await advisorA.client.from("job_notes").insert({ workshop_id: wsA, job_card_id: jobA, body: "Private note" });
    if (note.error) throw note.error;
  });

  it("hides another workshop's jobs, history and notes", async () => {
    const reads = await Promise.all([
      ownerB.client.from("job_cards").select("id").eq("id", jobA),
      ownerB.client.from("job_status_history").select("id").eq("job_card_id", jobA),
      ownerB.client.from("job_notes").select("id").eq("job_card_id", jobA),
      ownerB.client.rpc("search_job_cards", { ws: wsA }),
      ownerB.client.rpc("job_status_counts", { ws: wsA }),
    ]);
    for (const r of reads) expect(r.data).toEqual([]);
  });

  it("refuses to move or open jobs across workshops, without revealing they exist", async () => {
    const res = await move(ownerB.client, jobA, "complete_inspection", "awaiting_inspection");
    expect(res.error?.message).toBe("Job card not found");
    expect((await openJob(ownerB.client, wsA, vehicleA)).error).not.toBeNull();
    expect((await openJob(ownerB.client, wsB, vehicleA)).error?.message).toBe("Vehicle not found");
    expect((await mustOpenJob(ownerB.client, wsB, vehicleB))).toBeTruthy();
  });

  it("doesn't let notes be forged or edited", async () => {
    const forged = await advisorA.client
      .from("job_notes")
      .insert({ workshop_id: wsA, job_card_id: jobA, body: "Pretend", created_by: ownerA.id } as never);
    expect(forged.error).not.toBeNull();
    const edit = await advisorA.client.from("job_notes").update({ body: "Edited" }).eq("job_card_id", jobA);
    expect(edit.error).not.toBeNull();
    const cross = await ownerB.client.from("job_notes").insert({ workshop_id: wsA, job_card_id: jobA, body: "Intruder" });
    expect(cross.error).not.toBeNull();
  });
});

describe("attachments", () => {
  let jobA: string;
  const png = () => new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], { type: "image/png" });

  beforeAll(async () => {
    jobA = await mustOpenJob(advisorA.client, wsA, vehicleA);
  });

  it("stores files privately under the job and records them", async () => {
    const path = `${wsA}/${jobA}/photo-${run}.png`;
    const up = await advisorA.client.storage.from("job-attachments").upload(path, png(), { contentType: "image/png" });
    expect(up.error).toBeNull();
    const row = await advisorA.client
      .from("job_attachments")
      .insert({ workshop_id: wsA, job_card_id: jobA, storage_path: path, file_name: "front.png", content_type: "image/png", size_bytes: 8 })
      .select("id")
      .single();
    expect(row.error).toBeNull();

    const outsider = await ownerB.client.storage.from("job-attachments").download(path);
    expect(outsider.error).not.toBeNull();
    const insider = await cashierA.client.storage.from("job-attachments").download(path);
    expect(insider.error).toBeNull();

    const removed = await advisorA.client.from("job_attachments").update({ removed_at: new Date().toISOString() }).eq("id", row.data!.id).select("removed_by");
    expect(removed.data?.[0]?.removed_by).toBe(advisorA.id);
    const undo = await advisorA.client.from("job_attachments").update({ removed_at: null }).eq("id", row.data!.id);
    expect(undo.error).not.toBeNull();
  });

  it("refuses uploads into another workshop's folder", async () => {
    const res = await ownerB.client.storage.from("job-attachments").upload(`${wsA}/${jobA}/sneaky-${run}.png`, png(), { contentType: "image/png" });
    expect(res.error).not.toBeNull();
    const mismatched = await ownerB.client.storage.from("job-attachments").upload(`${wsB}/${jobA}/mixed-${run}.png`, png(), { contentType: "image/png" });
    expect(mismatched.error).not.toBeNull();
  });

  it("refuses records for files that don't exist or belong elsewhere", async () => {
    const ghost = await advisorA.client.from("job_attachments").insert({
      workshop_id: wsA,
      job_card_id: jobA,
      storage_path: `${wsA}/${jobA}/never-uploaded.png`,
      file_name: "ghost.png",
      content_type: "image/png",
      size_bytes: 8,
    });
    expect(ghost.error).not.toBeNull();
    const wrongFolder = await advisorA.client.from("job_attachments").insert({
      workshop_id: wsA,
      job_card_id: jobA,
      storage_path: `${wsB}/${jobA}/x.png`,
      file_name: "x.png",
      content_type: "image/png",
      size_bytes: 8,
    });
    expect(wrongFolder.error).not.toBeNull();
  });
});

describe("search", () => {
  it("finds jobs by plate and job number, and counts by status", async () => {
    const byPlate = await advisorA.client.rpc("search_job_cards", { ws: wsA, q: "lec 3001" });
    expect(byPlate.data?.length).toBeGreaterThan(0);
    const byNumber = await advisorA.client.rpc("search_job_cards", { ws: wsA, q: "JC-0001" });
    expect(byNumber.data?.map((j) => j.job_number)).toEqual(["JC-0001"]);
    const counts = await advisorA.client.rpc("job_status_counts", { ws: wsA });
    expect(counts.data?.find((c) => c.status === "delivered")?.job_count).toBe(1);
  });
});
