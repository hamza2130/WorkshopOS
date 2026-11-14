import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { randomUUID } from "node:crypto";
import type { Database } from "@/lib/supabase/database.types";

config({ path: [".env.local", ".env.test.local"], quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceKey) {
  throw new Error("Run `npm run db:env` with local Supabase running to create .env.local");
}

export type Client = SupabaseClient<Database>;
export type TestUser = { client: Client; email: string; id: string };

const PASSWORD = "Test-password-123!";
export const run = randomUUID().slice(0, 8);
export const admin: Client = createClient<Database>(url, serviceKey, { auth: { persistSession: false } });

export function anonClient(): Client {
  return createClient<Database>(url!, anonKey!, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function userClient(label: string): Promise<TestUser> {
  const email = `${label}-${run}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: label },
  });
  if (error) throw error;
  const client = anonClient();
  const signIn = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signIn.error) throw signIn.error;
  return { client, email, id: data.user.id };
}

export async function createWorkshop(client: Client, name: string) {
  const { data, error } = await client.rpc("create_workshop", { p_name: name });
  if (error) throw error;
  return data;
}

export async function addMember(
  owner: Client,
  workshopId: string,
  user: TestUser,
  role: Database["public"]["Enums"]["workshop_role"],
) {
  const invite = await owner.rpc("create_invitation", { ws: workshopId, p_email: user.email, p_role: role });
  if (invite.error) throw invite.error;
  const accepted = await user.client.rpc("accept_invitation", { p_token: invite.data });
  if (accepted.error) throw accepted.error;
}
