import { describe, expect, it } from "vitest";
import { WORKSHOP_DEFAULTS, workshopSchema } from "./workshop-schema";

const base = { ...WORKSHOP_DEFAULTS, name: "Hamid Autos", phone: "", email: "", address: "", city: "Lahore" };

describe("workshopSchema", () => {
  it("accepts Pakistan defaults and normalises blanks to null", () => {
    const parsed = workshopSchema.parse(base);
    expect(parsed).toMatchObject({ currency: "PKR", timezone: "Asia/Karachi", taxRate: 0, phone: null, email: null });
  });

  it("uppercases prefixes and rejects invalid ones", () => {
    expect(workshopSchema.parse({ ...base, invoicePrefix: "inv-lhr" }).invoicePrefix).toBe("INV-LHR");
    expect(workshopSchema.safeParse({ ...base, jobCardPrefix: "JOB CARD" }).success).toBe(false);
  });

  it("rejects unknown time zones and bad tax rates", () => {
    expect(workshopSchema.safeParse({ ...base, timezone: "Mars/Olympus" }).success).toBe(false);
    expect(workshopSchema.safeParse({ ...base, taxRate: "17.555" }).success).toBe(false);
    expect(workshopSchema.safeParse({ ...base, taxRate: "-1" }).success).toBe(false);
    expect(workshopSchema.parse({ ...base, taxRate: "17.5" }).taxRate).toBe(17.5);
    expect(workshopSchema.parse({ ...base, taxRate: "0.07" }).taxRate).toBe(0.07);
    expect(workshopSchema.safeParse({ ...base, taxRate: "101" }).success).toBe(false);
  });
});
