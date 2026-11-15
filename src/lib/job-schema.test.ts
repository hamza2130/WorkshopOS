import { describe, expect, it } from "vitest";
import { createJobSchema, statusChangeSchema } from "./job-schema";

describe("createJobSchema", () => {
  const base = { complaint: "Difficulty starting, AC not cooling" };

  it("accepts a minimal check-in", () => {
    expect(createJobSchema.parse(base)).toMatchObject({
      complaint: "Difficulty starting, AC not cooling",
      mileage: null,
      fuelLevel: null,
      advisorId: null,
      expectedDelivery: "",
    });
  });

  it("parses mileage, fuel and expected delivery", () => {
    const v = createJobSchema.parse({ ...base, mileage: "86500", fuelLevel: "half", expectedDelivery: "2026-11-16T18:00" });
    expect(v).toMatchObject({ mileage: 86500, fuelLevel: "half", expectedDelivery: "2026-11-16T18:00" });
  });

  it("rejects a missing complaint, bad mileage and unknown fuel level", () => {
    for (const bad of [{ complaint: " " }, { mileage: "86,500" }, { fuelLevel: "brimming" }, { advisorId: "bob" }]) {
      expect(createJobSchema.safeParse({ ...base, ...bad }).success).toBe(false);
    }
  });
});

describe("statusChangeSchema", () => {
  it("blanks an empty reason to null", () => {
    const v = statusChangeSchema.parse({
      jobId: "1f8b1c1e-6a1e-4c55-9c1e-2b7a4d0c9e11",
      action: "put_on_hold",
      expectedStatus: "in_progress",
      reason: "  ",
    });
    expect(v.reason).toBeNull();
  });
});
