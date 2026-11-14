import type { Permission } from "./auth/permissions";

export type NavItem = {
  href: string;
  label: string;
  // Shown when the user holds any of these; empty = everyone in the workshop.
  anyOf: readonly Permission[];
  phase?: number;
};

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/dashboard", label: "Dashboard", anyOf: [] },
  { href: "/jobs", label: "Job Cards", anyOf: ["jobs.manage", "jobs.view_assigned"], phase: 3 },
  { href: "/customers", label: "Customers", anyOf: ["customers.manage"], phase: 2 },
  { href: "/vehicles", label: "Vehicles", anyOf: ["vehicles.manage"], phase: 2 },
  { href: "/estimates", label: "Estimates", anyOf: ["estimates.manage"], phase: 4 },
  { href: "/inventory", label: "Inventory", anyOf: ["inventory.manage"], phase: 7 },
  { href: "/employees", label: "Employees", anyOf: ["staff.manage"] },
  { href: "/invoices", label: "Invoices", anyOf: ["invoices.manage", "payments.record"], phase: 6 },
  { href: "/reports", label: "Reports", anyOf: ["reports.operational", "reports.financial"], phase: 9 },
  { href: "/settings", label: "Settings", anyOf: ["workshop.settings"] },
];

export function visibleNav(permissions: ReadonlySet<Permission>) {
  return NAV_ITEMS.filter((item) => item.anyOf.length === 0 || item.anyOf.some((p) => permissions.has(p)));
}
