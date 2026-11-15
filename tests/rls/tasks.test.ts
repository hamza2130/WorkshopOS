import { beforeAll, describe, expect, it } from "vitest";
import { addMember, admin, createWorkshop, run, userClient, type Client, type TestUser } from "./helpers";
import { approveAll, completeInspection, draftEstimate, itemIds, sendEstimate } from "./workflow";

let ownerA: TestUser;
let advisorA: TestUser;
let mechanicA: TestUser;
let mechanic2A: TestUser;
let cashierA: TestUser;
let ownerB: TestUser;
let wsA: string;
let wsB: string;
let vehicleA: string;

async function newJob() {
  const res = await advisorA.client.rpc("create_job_card", { ws: wsA, p_vehicle: vehicleA, p_complaint: "Brakes squeal" });
  if (res.error) throw res.error;
  return res.data;
}

/** A job the customer has approved: one labour line and one part line. */
async function approvedJob() {
  const job = await newJob();
  await completeInspection(advisorA.client, job);
  const estimate = await draftEstimate(advisorA.client, wsA, job, [
    { description: "Replace front brake pads", unit_price: 3000, kind: "labour" },
    { description: "Front brake pad set", unit_price: 6500, kind: "part" },
  ]);
  const token = await sendEstimate(advisorA.client, estimate);
  const res = await approveAll(token, await itemIds(advisorA.client, estimate));
  if (res.error) throw res.error;
  return { job, estimate };
}

async function addTask(job: string, assignee: string | null = mechanicA.id, title = "Replace front brake pads") {
  const res = await advisorA.client
    .from("job_tasks")
    .insert({ workshop_id: wsA, job_card_id: job, title, assignee_id: assignee })
    .select("id")
    .single();
  if (res.error) throw res.error;
  return res.data.id;
}

async function taskRow(id: string) {
  const { data } = await admin.from("job_tasks").select("status, blocked_reason, started_at, completed_at").eq("id", id).single();
  return data;
}

async function jobStatus(job: string) {
  const { data } = await admin.from("job_cards").select("status").eq("id", job).single();
  return data?.status;
}

function move(client: Client, task: string, from: string, to: string, reason?: string) {
  return client.rpc("update_task_status", {
    p_task: task,
    p_expected_status: from as never,
    p_status: to as never,
    p_reason: reason,
  });
}

beforeAll(async () => {
  [ownerA, advisorA, mechanicA, mechanic2A, cashierA, ownerB] = await Promise.all([
    userClient("p5-owner-a"),
    userClient("p5-advisor-a"),
    userClient("p5-mechanic-a"),
    userClient("p5-mechanic2-a"),
    userClient("p5-cashier-a"),
    userClient("p5-owner-b"),
  ]);
  wsA = await createWorkshop(ownerA.client, `Alpha Tasks ${run}`);
  wsB = await createWorkshop(ownerB.client, `Bravo Tasks ${run}`);
  await addMember(ownerA.client, wsA, advisorA, "advisor");
  await addMember(ownerA.client, wsA, mechanicA, "mechanic");
  await addMember(ownerA.client, wsA, mechanic2A, "mechanic");
  await addMember(ownerA.client, wsA, cashierA, "cashier");

  const c = await advisorA.client
    .from("customers")
    .insert({ workshop_id: wsA, name: "Bilal Ahmed", phone: "0300 5000001", address: "Street 4, DHA" })
    .select("id")
    .single();
  if (c.error) throw c.error;
  const v = await advisorA.client
    .from("vehicles")
    .insert({ workshop_id: wsA, customer_id: c.data.id, registration_number: "LEC-5001", make: "Honda", model: "City" })
    .select("id")
    .single();
  if (v.error) throw v.error;
  vehicleA = v.data.id;
});

describe("a blocked task always records a reason (Phase 5 gate)", () => {
  it("refuses to block a task without a reason", async () => {
    const { job } = await approvedJob();
    const task = await addTask(job);
    expect((await move(mechanicA.client, task, "pending", "in_progress")).error).toBeNull();

    for (const reason of [undefined, "", "   "]) {
      const res = await move(mechanicA.client, task, "in_progress", "blocked", reason);
      expect(res.error?.message).toBe("reason_required");
    }
    expect((await taskRow(task))?.status).toBe("in_progress");

    // A task that hasn't started yet can't be blocked without one either.
    const other = await addTask(job, mechanicA.id, "Bleed brake lines");
    expect((await move(mechanicA.client, other, "pending", "blocked", " ")).error?.message).toBe("reason_required");
  });

  it("can't be bypassed by writing the status directly", async () => {
    const { job } = await approvedJob();
    const task = await addTask(job);

    // The status column isn't writable by staff at all.
    const direct = await advisorA.client.from("job_tasks").update({ status: "blocked" } as never).eq("id", task).select("id");
    expect(direct.error).not.toBeNull();
    expect((await taskRow(task))?.status).toBe("pending");

    // Even with full database rights, only update_task_status() may change it…
    const service = await admin.from("job_tasks").update({ status: "blocked", blocked_reason: "Waiting" }).eq("id", task);
    expect(service.error?.message).toBe("status_change_not_allowed");

    // …and the constraints refuse a blocked row without a reason.
    await move(mechanicA.client, task, "pending", "in_progress");
    await move(mechanicA.client, task, "in_progress", "blocked", "Pads out of stock");
    const cleared = await admin.from("job_tasks").update({ blocked_reason: "  " }).eq("id", task);
    expect(cleared.error?.code).toBe("23514");
    const history = await admin.from("job_task_history").insert({
      workshop_id: wsA,
      task_id: task,
      job_card_id: job,
      from_status: "in_progress",
      to_status: "blocked",
    });
    expect(history.error?.code).toBe("23514");
  });

  it("keeps every block and its reason in the task history", async () => {
    const { job } = await approvedJob();
    const task = await addTask(job);
    await move(mechanicA.client, task, "pending", "in_progress");
    expect((await move(mechanicA.client, task, "in_progress", "blocked", "  Pads out of stock ")).data).toBe("blocked");
    expect(await taskRow(task)).toMatchObject({ status: "blocked", blocked_reason: "Pads out of stock" });

    // Resuming clears the live reason; the history keeps it.
    await move(mechanicA.client, task, "blocked", "in_progress");
    expect((await taskRow(task))?.blocked_reason).toBeNull();
    await move(advisorA.client, task, "in_progress", "blocked", "Customer asked to pause");
    await move(mechanicA.client, task, "blocked", "in_progress");
    await move(mechanicA.client, task, "in_progress", "completed");

    const { data } = await mechanicA.client
      .from("job_task_history")
      .select("from_status, to_status, reason, changed_by, changed_at")
      .eq("task_id", task)
      .order("id");
    expect(data?.map((h) => [h.from_status, h.to_status, h.reason])).toEqual([
      [null, "pending", null],
      ["pending", "in_progress", null],
      ["in_progress", "blocked", "Pads out of stock"],
      ["blocked", "in_progress", null],
      ["in_progress", "blocked", "Customer asked to pause"],
      ["blocked", "in_progress", null],
      ["in_progress", "completed", null],
    ]);
    expect(data?.every((h) => h.changed_at && h.changed_by)).toBe(true);
    expect(data?.[2].changed_by).toBe(mechanicA.id);
    expect(data?.[4].changed_by).toBe(advisorA.id);
  });

  it("tells the advisor what is blocking the work", async () => {
    const { job } = await approvedJob();
    const task = await addTask(job);
    await move(mechanicA.client, task, "pending", "in_progress");
    await move(mechanicA.client, task, "in_progress", "blocked", "Caliper bolt seized");
    const { data } = await advisorA.client
      .from("notifications")
      .select("kind, body")
      .eq("kind", "task_blocked")
      .like("link", `%${job}`);
    expect(data).toEqual([{ kind: "task_blocked", body: "Replace front brake pads — Caliper bolt seized" }]);
  });
});

describe("task workflow", () => {
  it("moves the job into work when the first task starts", async () => {
    const { job } = await approvedJob();
    const task = await addTask(job);
    expect(await jobStatus(job)).toBe("approved");
    await move(mechanicA.client, task, "pending", "in_progress");
    expect(await jobStatus(job)).toBe("in_progress");
    expect((await taskRow(task))?.started_at).not.toBeNull();

    const { data } = await admin
      .from("job_status_history")
      .select("action, reason")
      .eq("job_card_id", job)
      .order("id", { ascending: false })
      .limit(1)
      .single();
    expect(data).toEqual({ action: "work_started", reason: 'p5-mechanic-a started "Replace front brake pads"' });
  });

  it("won't send a job to quality check while tasks are open", async () => {
    const { job } = await approvedJob();
    const t1 = await addTask(job);
    const t2 = await addTask(job, mechanic2A.id, "Road test");
    await move(mechanicA.client, t1, "pending", "in_progress");

    const early = await advisorA.client.rpc("change_job_status", {
      p_job: job,
      p_action: "finish_work",
      p_expected_status: "in_progress",
    });
    expect(early.error?.message).toBe("tasks_open");

    expect((await move(advisorA.client, t2, "pending", "cancelled", "Customer will road test")).data).toBe("cancelled");
    await move(mechanicA.client, t1, "in_progress", "completed");

    const { data: done } = await advisorA.client
      .from("notifications")
      .select("kind")
      .eq("kind", "tasks_completed")
      .like("link", `%${job}`);
    expect(done).toHaveLength(1);

    const finished = await advisorA.client.rpc("change_job_status", {
      p_job: job,
      p_action: "finish_work",
      p_expected_status: "in_progress",
    });
    expect(finished.error).toBeNull();
  });

  it("lets only the assignee or an advisor move a task, and only advisors cancel or reopen", async () => {
    const { job } = await approvedJob();
    const task = await addTask(job);
    await addTask(job, mechanic2A.id, "Road test");

    expect((await move(mechanic2A.client, task, "pending", "in_progress")).error?.code).toBe("42501");
    expect((await move(mechanicA.client, task, "pending", "cancelled", "Not needed")).error?.code).toBe("42501");
    await move(mechanicA.client, task, "pending", "in_progress");
    await move(mechanicA.client, task, "in_progress", "completed");
    expect((await move(mechanicA.client, task, "completed", "in_progress", "Missed a bolt")).error?.code).toBe("42501");
    expect((await move(advisorA.client, task, "completed", "in_progress")).error?.message).toBe("reason_required");
    expect((await move(advisorA.client, task, "completed", "in_progress", "Noise persists")).data).toBe("in_progress");

    // Stale screens are caught.
    expect((await move(mechanicA.client, task, "pending", "in_progress")).error?.message).toBe("status_changed");
    expect((await move(mechanicA.client, task, "in_progress", "pending")).error?.message).toBe("invalid_transition");
  });

  it("only assigns tasks to staff who can work on them", async () => {
    const { job } = await approvedJob();
    const res = await advisorA.client
      .from("job_tasks")
      .insert({ workshop_id: wsA, job_card_id: job, title: "Polish", assignee_id: cashierA.id });
    expect(res.error?.code).toBe("23514");
    const outsider = await advisorA.client
      .from("job_tasks")
      .insert({ workshop_id: wsA, job_card_id: job, title: "Polish", assignee_id: ownerB.id });
    expect(outsider.error?.code).toBe("23514");

    // Unassigned tasks can be planned but not started.
    const open = await addTask(job, null, "Wheel alignment");
    expect((await move(advisorA.client, open, "pending", "in_progress")).error?.message).toBe("unassigned");
  });

  it("refuses tasks before the customer has approved the work", async () => {
    const job = await newJob();
    const res = await advisorA.client.from("job_tasks").insert({ workshop_id: wsA, job_card_id: job, title: "Early task" });
    expect(res.error?.message).toBe("tasks_not_allowed");
  });

  it("creates tasks from the approved labour lines once", async () => {
    const { job } = await approvedJob();
    const first = await advisorA.client.rpc("create_tasks_from_estimate", { p_job: job, p_assignee: mechanicA.id });
    expect(first.data).toBe(1);
    const again = await advisorA.client.rpc("create_tasks_from_estimate", { p_job: job, p_assignee: mechanicA.id });
    expect(again.data).toBe(0);
    const { data } = await advisorA.client.from("job_tasks").select("id, title, assignee_id, estimate_item_id").eq("job_card_id", job);
    expect(data).toHaveLength(1);
    expect(data?.[0]).toMatchObject({ title: "Replace front brake pads", assignee_id: mechanicA.id });
    expect(data?.[0].estimate_item_id).not.toBeNull();

    expect((await mechanicA.client.rpc("create_tasks_from_estimate", { p_job: job })).error?.code).toBe("P0002");

    // Work the advisor cancelled on purpose isn't offered again.
    await move(advisorA.client, data![0].id, "pending", "cancelled", "Customer will do it later");
    expect((await advisorA.client.rpc("create_tasks_from_estimate", { p_job: job })).data).toBe(0);
  });

  it("notifies the mechanic about new work", async () => {
    const { job } = await approvedJob();
    await addTask(job, mechanic2A.id, "Check wheel bearings");
    const { data } = await mechanic2A.client.from("notifications").select("kind, body, link").eq("link", `/my-jobs/${job}`);
    expect(data).toEqual([{ kind: "task_assigned", body: "Check wheel bearings", link: `/my-jobs/${job}` }]);
  });
});

describe("what mechanics can see", () => {
  it("shows mechanics only the jobs they are assigned to", async () => {
    const { job: mine } = await approvedJob();
    const { job: theirs } = await approvedJob();
    await addTask(mine);
    await addTask(theirs, mechanic2A.id);

    const list = await mechanicA.client.rpc("my_assigned_jobs", { ws: wsA });
    const ids = (list.data ?? []).map((j) => j.id);
    expect(ids).toContain(mine);
    expect(ids).not.toContain(theirs);

    expect((await mechanicA.client.rpc("get_assigned_job", { p_job: theirs })).data).toBeNull();
    expect((await mechanicA.client.from("job_tasks").select("id").eq("job_card_id", theirs)).data).toEqual([]);
    expect((await mechanicA.client.from("job_cards").select("id")).data).toEqual([]);
    expect((await mechanicA.client.from("customers").select("id")).data).toEqual([]);
  });

  it("gives mechanics the work without prices or customer details", async () => {
    const { job } = await approvedJob();
    await addTask(job);
    const { data, error } = await mechanicA.client.rpc("get_assigned_job", { p_job: job });
    expect(error).toBeNull();
    const detail = data as Record<string, unknown>;
    expect(detail).toMatchObject({ job_number: expect.any(String), complaint: "Brakes squeal" });
    expect(detail.vehicle).toMatchObject({ registration_number: "LEC-5001", make: "Honda" });
    expect((detail.approved_work as unknown[]).length).toBe(2);

    const text = JSON.stringify(data);
    for (const hidden of ["unit_price", "line_total", "total", "6500", "Bilal", "0300", "phone", "address", "customer"]) {
      expect(text).not.toContain(hidden);
    }
  });

  it("lets assigned mechanics add internal notes and parts, nowhere else", async () => {
    const { job, estimate } = await approvedJob();
    const { job: other } = await approvedJob();
    const task = await addTask(job);
    await addTask(other, mechanic2A.id);

    const note = await mechanicA.client
      .from("job_notes")
      .insert({ workshop_id: wsA, job_card_id: job, body: "Rotor scored, measured 22.1mm" });
    expect(note.error).toBeNull();
    const customerNote = await mechanicA.client
      .from("job_notes")
      .insert({ workshop_id: wsA, job_card_id: job, body: "Hi", visibility: "customer" });
    expect(customerNote.error).not.toBeNull();
    const elsewhere = await mechanicA.client.from("job_notes").insert({ workshop_id: wsA, job_card_id: other, body: "Hello" });
    expect(elsewhere.error).not.toBeNull();

    const part = (await itemIds(advisorA.client, estimate))[1];
    const used = await mechanicA.client
      .from("job_parts_used")
      .insert({ workshop_id: wsA, job_card_id: job, task_id: task, estimate_item_id: part, description: "Front pads", quantity: 1 })
      .select("id, part_id, recorded_by")
      .single();
    expect(used.error).toBeNull();
    expect(used.data?.recorded_by).toBe(mechanicA.id);

    const freeText = await mechanicA.client
      .from("job_parts_used")
      .insert({ workshop_id: wsA, job_card_id: job, description: "Copper grease", quantity: 0.5 });
    expect(freeText.error).toBeNull();
    const wrongJob = await mechanicA.client
      .from("job_parts_used")
      .insert({ workshop_id: wsA, job_card_id: other, description: "Copper grease", quantity: 1 });
    expect(wrongJob.error).not.toBeNull();

    // Entries are corrected by removing them, never edited.
    const edit = await admin.from("job_parts_used").update({ quantity: 4 }).eq("id", used.data!.id);
    expect(edit.error?.code).toBe("55000");
    const removed = await mechanicA.client
      .from("job_parts_used")
      .update({ removed_at: new Date().toISOString() })
      .eq("id", used.data!.id)
      .select("removed_by")
      .single();
    expect(removed.data?.removed_by).toBe(mechanicA.id);
  });

  it("keeps other workshops out", async () => {
    const { job } = await approvedJob();
    const task = await addTask(job);
    expect((await ownerB.client.from("job_tasks").select("id").eq("id", task)).data).toEqual([]);
    expect((await move(ownerB.client, task, "pending", "in_progress")).error?.code).toBe("P0002");
    expect((await ownerB.client.rpc("get_assigned_job", { p_job: job })).data).toBeNull();
    expect((await ownerB.client.rpc("my_assigned_jobs", { ws: wsA })).data).toEqual([]);
    const intrude = await ownerB.client.from("job_tasks").insert({ workshop_id: wsA, job_card_id: job, title: "Sneaky" });
    expect(intrude.error).not.toBeNull();
    const intrudeB = await ownerB.client.from("job_tasks").insert({ workshop_id: wsB, job_card_id: job, title: "Sneaky" });
    expect(intrudeB.error).not.toBeNull();
  });
});
