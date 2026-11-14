import { describe, expect, it } from "vitest";
import { isValidPhone, normalizePhone, normalizeRegistration, whatsappLink } from "./phone";
import { PHONE_SAMPLES } from "./phone.fixtures";

describe("normalizePhone", () => {
  it.each(PHONE_SAMPLES)("%s → %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it("validates length after normalising", () => {
    expect(isValidPhone("0300 1234567")).toBe(true);
    expect(isValidPhone("12345")).toBe(false);
  });

  it("builds a wa.me link from any format", () => {
    expect(whatsappLink("0300-1234567", "Hi")).toBe("https://wa.me/923001234567?text=Hi");
  });
});

describe("normalizeRegistration", () => {
  it("ignores case, spaces and dashes", () => {
    for (const plate of ["LEA-1234", "lea 1234", "Lea1234", " LEA - 1234 "]) {
      expect(normalizeRegistration(plate)).toBe("LEA1234");
    }
    expect(normalizeRegistration("ICT/AB-123")).toBe("ICTAB123");
  });
});
