import { describe, expect, it } from "vitest";
import { countSchema, formatQty, receiveSchema, stockLevel, stockSettingsSchema } from "./inventory";

const id = "5b2f3f43-2d8c-4a39-9b39-6a5f4f0c1a11";

describe("stockLevel", () => {
  it("names how a part stands", () => {
    const part = (stock_on_hand: number, reorder_level: number | null = 3, track_stock = true) => stockLevel({ track_stock, stock_on_hand, reorder_level });
    expect(part(10)).toBe("ok");
    expect(part(3)).toBe("low");
    expect(part(0)).toBe("out");
    expect(part(-2)).toBe("negative");
    expect(part(1, null)).toBe("ok");
    expect(part(0, null, false)).toBe("untracked");
  });
});

describe("stock forms", () => {
  it("reads received quantities and an optional cost", () => {
    expect(receiveSchema.parse({ partId: id, quantity: "1,200", unitCost: "", supplier: " ", reference: "" })).toMatchObject({
      quantity: 1200,
      unitCost: null,
      supplier: null,
    });
    for (const quantity of ["0", "-1", "2.555", "abc", ""]) {
      expect(receiveSchema.safeParse({ partId: id, quantity, unitCost: "" }).success, quantity).toBe(false);
    }
  });

  it("allows counting zero but always wants a reason", () => {
    expect(countSchema.parse({ partId: id, counted: "0", reason: "Shelf empty" }).counted).toBe(0);
    expect(countSchema.safeParse({ partId: id, counted: "4", reason: "  " }).success).toBe(false);
  });

  it("treats an empty reorder level as none", () => {
    expect(stockSettingsSchema.parse({ partId: id, trackStock: "on", reorderLevel: "", location: "" })).toEqual({
      partId: id,
      trackStock: true,
      reorderLevel: null,
      location: null,
    });
    expect(stockSettingsSchema.parse({ partId: id, reorderLevel: "5", location: "A3" })).toMatchObject({ trackStock: false, reorderLevel: 5 });
  });

  it("prints quantities without trailing zeros", () => {
    expect(formatQty("12.00")).toBe("12");
    expect(formatQty(2.5)).toBe("2.5");
    expect(formatQty(-3)).toBe("-3");
  });
});
