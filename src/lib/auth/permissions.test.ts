import { describe, expect, it } from "vitest";
import { can, GRANTABLE_PERMISSIONS, permissionsFor, PERMISSIONS } from "./permissions";

describe("permissions", () => {
  it("gives the owner every permission", () => {
    expect(permissionsFor("owner").size).toBe(PERMISSIONS.length);
  });

  it("keeps mechanics away from financial and staff actions", () => {
    for (const p of ["payments.record", "invoices.manage", "staff.manage", "workshop.settings"] as const) {
      expect(can("mechanic", [], p)).toBe(false);
    }
    expect(can("mechanic", [], "tasks.update")).toBe(true);
  });

  it("lets an owner grant extra permissions", () => {
    expect(can("advisor", [], "reports.financial")).toBe(false);
    expect(can("advisor", ["reports.financial"], "reports.financial")).toBe(true);
  });

  it("never grants owner-only permissions through extras", () => {
    expect(can("advisor", ["staff.manage", "subscription.manage"], "staff.manage")).toBe(false);
    expect(GRANTABLE_PERMISSIONS).not.toContain("staff.manage");
  });

  it("ignores unknown permission strings", () => {
    expect(permissionsFor("mechanic", ["root.everything"]).size).toBe(2);
  });
});
