"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { GRANTABLE_PERMISSIONS, INVITABLE_ROLES, ROLES } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { formValues, invalid, type ActionState } from "@/lib/forms";
import { siteUrl } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export type InviteState = ActionState & { inviteUrl?: string; inviteEmail?: string };

const inviteSchema = z.object({
  email: z.email("Enter a valid email address.").trim().toLowerCase(),
  role: z.enum(INVITABLE_ROLES, { error: "Choose a role." }),
});

export async function inviteEmployee(_: InviteState | undefined, formData: FormData): Promise<InviteState> {
  const ctx = await requirePermission("staff.manage");
  const parsed = inviteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formData);

  const supabase = await createClient();
  const { data: token, error } = await supabase.rpc("create_invitation", {
    ws: ctx.workshop.workshopId,
    p_email: parsed.data.email,
    p_role: parsed.data.role,
  });
  if (error || !token) {
    const message = error?.code === "23505" ? "This person is already an active member." : "We couldn't create the invite.";
    return { error: message, values: formValues(formData) };
  }

  revalidatePath("/employees");
  return {
    success: `Invite created for ${parsed.data.email}. Share this link with them — it works once and expires in 7 days.`,
    inviteUrl: `${siteUrl}/invite/${token}`,
    inviteEmail: parsed.data.email,
  };
}

export async function revokeInvitation(_: ActionState | undefined, formData: FormData): Promise<ActionState> {
  const ctx = await requirePermission("staff.manage");
  const id = z.uuid().safeParse(formData.get("invitationId"));
  if (!id.success) return { error: "Invalid invitation." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workshop_invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id.data)
    .eq("workshop_id", ctx.workshop.workshopId)
    .select("id");
  if (error || !data?.length) return { error: "We couldn't revoke that invite." };

  revalidatePath("/employees");
  return { success: "Invite revoked." };
}

const memberSchema = z.object({
  memberId: z.uuid(),
  role: z.enum(ROLES),
  extraPermissions: z.array(z.enum(GRANTABLE_PERMISSIONS)),
});

export async function updateMember(_: ActionState | undefined, formData: FormData): Promise<ActionState> {
  const ctx = await requirePermission("staff.manage");
  const parsed = memberSchema.safeParse({
    memberId: formData.get("memberId"),
    role: formData.get("role"),
    extraPermissions: formData.getAll("extraPermissions"),
  });
  if (!parsed.success) return { error: "Choose a valid role and permissions." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workshop_members")
    .update({ role: parsed.data.role, extra_permissions: parsed.data.extraPermissions })
    .eq("id", parsed.data.memberId)
    .eq("workshop_id", ctx.workshop.workshopId)
    .select("id");
  if (error) return { error: error.code === "P0001" ? error.message : "We couldn't update this member." };
  if (!data?.length) return { error: "Member not found." };

  revalidatePath("/", "layout");
  return { success: "Saved." };
}

export async function setMemberActive(_: ActionState | undefined, formData: FormData): Promise<ActionState> {
  const ctx = await requirePermission("staff.manage");
  const memberId = z.uuid().safeParse(formData.get("memberId"));
  if (!memberId.success) return { error: "Invalid member." };
  const active = formData.get("active") === "true";

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workshop_members")
    .update({ is_active: active })
    .eq("id", memberId.data)
    .eq("workshop_id", ctx.workshop.workshopId)
    .select("id");
  if (error) return { error: error.code === "P0001" ? error.message : "We couldn't update this member." };
  if (!data?.length) return { error: "Member not found." };

  revalidatePath("/employees");
  return { success: active ? "Reactivated." : "Deactivated." };
}
