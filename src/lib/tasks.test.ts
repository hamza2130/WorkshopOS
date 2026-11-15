import { describe, expect, it } from "vitest";
import { partUsedSchema, taskMoves, taskSchema, taskStatusSchema } from "./tasks";

const id = "5b2f3f43-2d8c-4a39-9b39-6a5f4f0c1a11";
const moves = (...args: Parameters<typeof taskMoves>) => taskMoves(...args).map((m) => `${m.label}->${m.to}`);

describe("taskMoves", () => {
  it("lets the assigned mechanic start, finish and block their task", () => {
    const mechanic = { manager: false, assignee: true };
    expect(moves("pending", mechanic)).toEqual(["Start->in_progress", "Blocked->blocked"]);
    expect(moves("in_progress", mechanic)).toEqual(["Mark done->completed", "Blocked->blocked"]);
    expect(moves("blocked", mechanic)).toEqual(["Resume->in_progress"]);
    expect(moves("completed", mechanic)).toEqual([]);
  });

  it("always asks for a reason to block, cancel or reopen", () => {
    const all = (["pending", "in_progress", "blocked", "completed"] as const).flatMap((s) =>
      taskMoves(s, { manager: true, assignee: true }),
    );
    for (const m of all) {
      expect(m.needsReason).toBe(m.to === "blocked" || m.to === "cancelled" || m.label === "Reopen");
    }
  });

  it("keeps cancelling and reopening for advisors", () => {
    const advisor = { manager: true, assignee: false };
    expect(moves("completed", advisor)).toEqual(["Reopen->in_progress"]);
    expect(moves("blocked", advisor)).toEqual(["Resume->in_progress", "Cancel task->cancelled"]);
    expect(moves("cancelled", advisor)).toEqual([]);
  });

  it("offers no way to start, resume or reopen while the job is on hold", () => {
    const onHold = { manager: true, assignee: true, jobOnHold: true };
    expect(moves("pending", onHold)).toEqual(["Blocked->blocked", "Cancel task->cancelled"]);
    expect(moves("in_progress", onHold)).toEqual(["Mark done->completed", "Blocked->blocked", "Cancel task->cancelled"]);
    expect(moves("blocked", onHold)).toEqual(["Cancel task->cancelled"]);
    expect(moves("completed", onHold)).toEqual([]);
  });

  it("gives other mechanics nothing to press", () => {
    expect(moves("pending", { manager: false, assignee: false })).toEqual([]);
  });
});

describe("task forms", () => {
  it("requires a title and allows an unassigned task", () => {
    expect(taskSchema.safeParse({ jobId: id, title: " " }).success).toBe(false);
    const ok = taskSchema.parse({ jobId: id, title: " Replace pads ", assigneeId: "", priority: "high" });
    expect(ok).toMatchObject({ title: "Replace pads", assigneeId: null, priority: "high", description: null });
  });

  it("turns an empty reason into null so the database refuses the block", () => {
    const d = taskStatusSchema.parse({ jobId: id, taskId: id, expected: "in_progress", to: "blocked", reason: "   " });
    expect(d.reason).toBeNull();
  });

  it("reads part quantities as decimals", () => {
    expect(partUsedSchema.parse({ jobId: id, quantity: "0.5", source: "" }).quantity).toBe(0.5);
    for (const quantity of ["0", "-1", "1.234", "abc", ""]) {
      expect(partUsedSchema.safeParse({ jobId: id, quantity, source: "" }).success).toBe(false);
    }
  });
});
