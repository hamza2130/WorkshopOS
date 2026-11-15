import { describe, expect, it } from "vitest";
import { utcToZonedLocal, zonedLocalToUtc } from "./datetime";

describe("zonedLocalToUtc", () => {
  it("treats the typed time as workshop time", () => {
    expect(zonedLocalToUtc("2026-11-15T17:30", "Asia/Karachi")?.toISOString()).toBe("2026-11-15T12:30:00.000Z");
    expect(zonedLocalToUtc("2026-11-15T17:30", "UTC")?.toISOString()).toBe("2026-11-15T17:30:00.000Z");
  });

  it("handles a zone with daylight saving", () => {
    // London is UTC+1 in July.
    expect(zonedLocalToUtc("2026-07-01T09:00", "Europe/London")?.toISOString()).toBe("2026-07-01T08:00:00.000Z");
  });

  it("rejects malformed input", () => {
    expect(zonedLocalToUtc("15/11/2026 5pm", "Asia/Karachi")).toBeNull();
  });
});

describe("utcToZonedLocal", () => {
  it("round-trips", () => {
    expect(utcToZonedLocal("2026-11-15T12:30:00Z", "Asia/Karachi")).toBe("2026-11-15T17:30");
    expect(utcToZonedLocal(zonedLocalToUtc("2026-12-31T23:45", "Asia/Karachi")!, "Asia/Karachi")).toBe("2026-12-31T23:45");
  });
});
