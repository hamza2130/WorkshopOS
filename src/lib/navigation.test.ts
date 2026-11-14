import { describe, expect, it } from "vitest";
import { permissionsFor } from "./auth/permissions";
import { visibleNav } from "./navigation";

const labels = (role: Parameters<typeof permissionsFor>[0]) => visibleNav(permissionsFor(role)).map((i) => i.label);

describe("visibleNav", () => {
  it("shows the owner every section", () => {
    expect(labels("owner")).toHaveLength(10);
  });

  it("shows a mechanic only their jobs", () => {
    expect(labels("mechanic")).toEqual(["Dashboard", "Job Cards"]);
  });

  it("shows a cashier invoices and reports but not staff or settings", () => {
    expect(labels("cashier")).toEqual(["Dashboard", "Invoices", "Reports"]);
  });
});
