import { describe, expect, it } from "vitest";
import { customerSchema, mileageSchema, vehicleSchema } from "./record-schemas";

describe("customerSchema", () => {
  const base = { name: "Asif Khan", phone: "0300 1234567", whatsappSameAsPhone: "on" };

  it("copies the phone to WhatsApp when ticked and blanks optional fields to null", () => {
    expect(customerSchema.parse(base)).toEqual({
      name: "Asif Khan",
      phone: "0300 1234567",
      whatsapp: "0300 1234567",
      email: null,
      address: null,
      notes: null,
      confirmSharedPhone: false,
    });
  });

  it("rejects bad phone, WhatsApp and email", () => {
    const r = customerSchema.safeParse({ ...base, phone: "123", whatsappSameAsPhone: undefined, whatsapp: "12", email: "x" });
    expect(r.success).toBe(false);
    const paths = r.error!.issues.map((i) => i.path[0]);
    expect(paths).toEqual(expect.arrayContaining(["phone", "email"]));
  });

  it("reads the shared-number confirmation checkbox", () => {
    expect(customerSchema.parse({ ...base, confirmSharedPhone: "on" }).confirmSharedPhone).toBe(true);
  });
});

describe("vehicleSchema", () => {
  const base = { registrationNumber: "LEA-1234", make: "Toyota", model: "Corolla" };

  it("accepts the minimum and turns blanks into nulls", () => {
    const v = vehicleSchema.parse(base);
    expect(v).toMatchObject({ year: null, engineCc: null, fuelType: null, mileage: null, vin: null });
  });

  it("parses numbers and enums", () => {
    const v = vehicleSchema.parse({ ...base, year: "2018", engineCc: "1300", fuelType: "cng", mileage: "85000", vin: "abc123" });
    expect(v).toMatchObject({ year: 2018, engineCc: 1300, fuelType: "cng", mileage: 85000, vin: "ABC123" });
  });

  it("rejects out-of-range or malformed values", () => {
    for (const bad of [{ year: "1800" }, { engineCc: "12.5" }, { fuelType: "steam" }, { registrationNumber: "-" }, { make: " " }]) {
      expect(vehicleSchema.safeParse({ ...base, ...bad }).success).toBe(false);
    }
  });
});

describe("mileageSchema", () => {
  it("requires a reading", () => {
    expect(mileageSchema.safeParse({ reading: "" }).success).toBe(false);
    expect(mileageSchema.parse({ reading: "90500", note: "" })).toEqual({ reading: 90500, note: null });
  });
});
