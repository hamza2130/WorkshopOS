import { describe, expect, it } from "vitest";
import { formatMoney, parseMoney } from "./money";

describe("formatMoney", () => {
  // Intl separates the symbol with a non-breaking space; compare with a plain one.
  const plain = (s: string) => s.replace(/ /g, " ");

  it("shows rupees without decimals unless there are paisa", () => {
    expect(plain(formatMoney(25000))).toBe("Rs 25,000");
    expect(plain(formatMoney("2723.5"))).toBe("Rs 2,723.50");
    expect(plain(formatMoney(null))).toBe("Rs 0");
  });
});

describe("parseMoney", () => {
  it("accepts commas and up to two decimals", () => {
    expect(parseMoney("1,250.50")).toBe(1250.5);
    expect(parseMoney("900")).toBe(900);
    expect(parseMoney("")).toBeNull();
  });

  it("rejects negatives, letters and extra decimals", () => {
    for (const bad of ["-5", "12.345", "abc", "1e5"]) expect(parseMoney(bad)).toBeNaN();
  });
});
