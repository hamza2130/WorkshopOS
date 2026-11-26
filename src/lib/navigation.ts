import type { Permission } from "./auth/permissions";

export type NavItem = {
  href: string;
  label: string;
  // Shown when the user holds any of these; empty = everyone in the workshop.
  anyOf: readonly Permission[];
  phase?: number;
};

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/dashboard", label: "Dashboard", anyOf: ["dashboard.view"] },
  { href: "/my-jobs", label: "My jobs", anyOf: ["jobs.view_assigned"] },
  { href: "/jobs", label: "Job Cards", anyOf: ["jobs.manage"] },
  { href: "/customers", label: "Customers", anyOf: ["customers.manage"] },
  { href: "/vehicles", label: "Vehicles", anyOf: ["vehicles.manage"] },
  { href: "/estimates", label: "Estimates", anyOf: ["estimates.manage"] },
  { href: "/inventory", label: "Inventory", anyOf: ["inventory.manage"], phase: 7 },
  { href: "/employees", label: "Employees", anyOf: ["staff.manage"] },
  // Advisors see billing too (read-only): they hand cars back and need to know what's owed.
  { href: "/invoices", label: "Invoices", anyOf: ["invoices.manage", "payments.record", "jobs.manage"] },
  { href: "/reports", label: "Reports", anyOf: ["reports.operational", "reports.financial"], phase: 9 },
  { href: "/settings", label: "Settings", anyOf: ["workshop.settings"] },
];

export function visibleNav(permissions: ReadonlySet<Permission>) {
  return NAV_ITEMS.filter((item) => item.anyOf.length === 0 || item.anyOf.some((p) => permissions.has(p)));
}
