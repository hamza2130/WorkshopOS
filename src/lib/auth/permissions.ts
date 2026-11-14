export const ROLES = ["owner", "advisor", "mechanic", "inventory_manager", "cashier"] as const;
export type Role = (typeof ROLES)[number];

// Owners are made by promoting an existing member, never by invitation.
export const INVITABLE_ROLES = ["advisor", "mechanic", "inventory_manager", "cashier"] as const;

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Workshop owner",
  advisor: "Service advisor",
  mechanic: "Mechanic",
  inventory_manager: "Inventory manager",
  cashier: "Accountant / cashier",
};

export const PERMISSIONS = [
  "dashboard.view",
  "workshop.settings",
  "staff.manage",
  "activity.view",
  "subscription.manage",
  "customers.manage",
  "vehicles.manage",
  "jobs.manage",
  "jobs.view_assigned",
  "tasks.update",
  "estimates.manage",
  "inventory.manage",
  "invoices.manage",
  "payments.record",
  "reports.operational",
  "reports.financial",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const PERMISSION_LABELS: Record<Permission, string> = {
  "dashboard.view": "View the dashboard",
  "workshop.settings": "Change workshop settings",
  "staff.manage": "Manage employees",
  "activity.view": "View the activity log",
  "subscription.manage": "Manage the subscription",
  "customers.manage": "Manage customers",
  "vehicles.manage": "Manage vehicles",
  "jobs.manage": "Manage all job cards",
  "jobs.view_assigned": "See assigned jobs",
  "tasks.update": "Update task progress",
  "estimates.manage": "Prepare estimates",
  "inventory.manage": "Manage inventory",
  "invoices.manage": "Manage invoices",
  "payments.record": "Record payments",
  "reports.operational": "View operational reports",
  "reports.financial": "View financial reports",
};

// Owner-only permissions can never be granted to another role via extra_permissions.
const OWNER_ONLY: ReadonlySet<Permission> = new Set(["staff.manage", "subscription.manage"]);

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  owner: PERMISSIONS,
  advisor: [
    "dashboard.view",
    "activity.view",
    "customers.manage",
    "vehicles.manage",
    "jobs.manage",
    "estimates.manage",
    "reports.operational",
  ],
  mechanic: ["jobs.view_assigned", "tasks.update"],
  inventory_manager: ["dashboard.view", "inventory.manage"],
  cashier: ["dashboard.view", "invoices.manage", "payments.record", "reports.financial"],
};

export const GRANTABLE_PERMISSIONS: readonly Permission[] = PERMISSIONS.filter(
  (p) => !OWNER_ONLY.has(p),
);

export function isPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value);
}

export function permissionsFor(role: Role, extra: readonly string[] = []): Set<Permission> {
  const granted = new Set<Permission>(ROLE_PERMISSIONS[role]);
  for (const p of extra) {
    if (isPermission(p) && !OWNER_ONLY.has(p)) granted.add(p);
  }
  return granted;
}

export function can(role: Role, extra: readonly string[], permission: Permission): boolean {
  return permissionsFor(role, extra).has(permission);
}
