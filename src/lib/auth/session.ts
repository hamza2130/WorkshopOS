import "server-only";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { can, permissionsFor, type Permission, type Role } from "./permissions";

export const ACTIVE_WORKSHOP_COOKIE = "active_workshop";

export type Membership = {
  workshopId: string;
  workshopName: string;
  timezone: string;
  currency: string;
  role: Role;
  extraPermissions: string[];
};

export type WorkshopContext = {
  userId: string;
  email: string;
  fullName: string;
  workshop: Membership;
  memberships: Membership[];
  permissions: Set<Permission>;
};

// Verified with the auth server, once per request.
export const getUser = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
});

export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

export const getMemberships = cache(async (): Promise<Membership[]> => {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workshop_members")
    .select("workshop_id, role, extra_permissions, workshops(name, timezone, currency)")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("created_at");
  if (error) throw error;
  return data.map((m) => ({
    workshopId: m.workshop_id,
    workshopName: m.workshops?.name ?? "Workshop",
    timezone: m.workshops?.timezone ?? "Asia/Karachi",
    currency: m.workshops?.currency ?? "PKR",
    role: m.role,
    extraPermissions: m.extra_permissions,
  }));
});

// The workshop the signed-in user is working in. Redirects to onboarding if they have none.
export const getWorkshopContext = cache(async (): Promise<WorkshopContext> => {
  const user = await requireUser();
  const memberships = await getMemberships();
  if (memberships.length === 0) redirect("/onboarding");

  const chosen = (await cookies()).get(ACTIVE_WORKSHOP_COOKIE)?.value;
  const workshop = memberships.find((m) => m.workshopId === chosen) ?? memberships[0];

  return {
    userId: user.id,
    email: user.email ?? "",
    fullName: (user.user_metadata?.full_name as string | undefined) ?? "",
    workshop,
    memberships,
    permissions: permissionsFor(workshop.role, workshop.extraPermissions),
  };
});

export class ForbiddenError extends Error {
  constructor(permission: Permission) {
    super(`You don't have permission to do this (${permission}).`);
  }
}

// Use at the top of every server action.
export async function requirePermission(permission: Permission): Promise<WorkshopContext> {
  const ctx = await getWorkshopContext();
  if (!can(ctx.workshop.role, ctx.workshop.extraPermissions, permission)) {
    throw new ForbiddenError(permission);
  }
  return ctx;
}

// Use at the top of protected pages: users without access get a 404, not an error screen.
export async function requirePageAccess(...anyOf: Permission[]): Promise<WorkshopContext> {
  const ctx = await getWorkshopContext();
  if (!anyOf.some((p) => ctx.permissions.has(p))) notFound();
  return ctx;
}
