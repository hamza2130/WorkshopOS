import { describe, expect, it } from "vitest";
import { passwordSchema, safeNext } from "./forms";

describe("safeNext", () => {
  it("keeps same-site paths", () => {
    expect(safeNext("/invite/abc")).toBe("/invite/abc");
  });

  it("rejects external and protocol-relative redirects", () => {
    for (const bad of ["https://evil.test", "//evil.test", "/\\evil.test", "dashboard", null]) {
      expect(safeNext(bad)).toBe("/dashboard");
    }
  });
});

describe("passwordSchema", () => {
  it("requires length, a letter and a number", () => {
    expect(passwordSchema.safeParse("short1").success).toBe(false);
    expect(passwordSchema.safeParse("onlyletters").success).toBe(false);
    expect(passwordSchema.safeParse("12345678").success).toBe(false);
    expect(passwordSchema.safeParse("garage2026").success).toBe(true);
  });
});
