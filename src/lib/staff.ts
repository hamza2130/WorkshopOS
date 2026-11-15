import "server-only";
import { permissionsFor } from "./auth/permissions";
import { createClient } from "./supabase/server";

export type StaffOption = { id: string; name: string };

// Active members who can run job cards — the people a job can be assigned to as service advisor.
export async function getServiceAdvisors(workshopId: string): Promise<StaffOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("workshop_members")
    .select("user_id, role, extra_permissions, profiles(full_name, email)")
    .eq("workshop_id", workshopId)
    .eq("is_active", true)
    .order("created_at");
  return (data ?? [])
    .filter((m) => permissionsFor(m.role, m.extra_permissions).has("jobs.manage"))
    .map((m) => ({ id: m.user_id, name: m.profiles?.full_name || m.profiles?.email || "Staff member" }));
}
