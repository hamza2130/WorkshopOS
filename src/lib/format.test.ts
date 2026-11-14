import { describe, expect, it } from "vitest";
import { formatDate } from "./format";

describe("formatDate", () => {
  it("shows UTC timestamps in the workshop's time zone", () => {
    // 21:30 UTC on 14 Nov is already 15 Nov in Karachi (UTC+5).
    expect(formatDate("2026-11-14T21:30:00Z", "Asia/Karachi")).toMatch(/15/);
    expect(formatDate("2026-11-14T21:30:00Z", "UTC")).toMatch(/14/);
  });
});
