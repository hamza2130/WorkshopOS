import { describe, expect, it } from "vitest";
import { labourSchema, lineSchema, partSchema } from "./estimates";

describe("lineSchema", () => {
  const base = { kind: "part", description: "Brake pads", quantity: "2", unitPrice: "3,500" };

  it("parses quantity, price, discount and taxable", () => {
    expect(lineSchema.parse({ ...base, discount: "500", taxable: "on" })).toMatchObject({
      quantity: 2,
      unitPrice: 3500,
      discount: 500,
      taxable: true,
      source: "customer_request",
      inspectionCategory: null,
    });
  });

  it("rejects a discount larger than the line, zero quantity and bad prices", () => {
    expect(lineSchema.safeParse({ ...base, discount: "7001" }).success).toBe(false);
    expect(lineSchema.safeParse({ ...base, quantity: "0" }).success).toBe(false);
    expect(lineSchema.safeParse({ ...base, unitPrice: "12.345" }).success).toBe(false);
    expect(lineSchema.safeParse({ ...base, unitPrice: "" }).success).toBe(false);
  });

  it("links a recommendation to its inspection category", () => {
    const v = lineSchema.parse({ ...base, source: "recommendation", inspectionCategory: "brakes" });
    expect(v).toMatchObject({ source: "recommendation", inspectionCategory: "brakes" });
  });
});

describe("catalogue schemas", () => {
  it("validates labour and parts", () => {
    expect(labourSchema.parse({ name: "Oil change", defaultPrice: "1500", estimatedMinutes: "30" })).toMatchObject({
      defaultPrice: 1500,
      estimatedMinutes: 30,
      description: null,
    });
    expect(partSchema.parse({ name: "Oil filter", sellingPrice: "900" })).toMatchObject({ costPrice: null, unit: "piece" });
    expect(partSchema.safeParse({ name: "Oil filter", sellingPrice: "free" }).success).toBe(false);
  });
});
