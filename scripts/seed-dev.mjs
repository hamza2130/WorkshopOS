// Creates local-only test accounts and the "Alpha Motors" workshop. Safe to re-run.
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: [".env.local", ".env.test.local"], quiet: true });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url?.includes("127.0.0.1") || !anon || !service) {
  console.error("Refusing to run: needs the local Supabase stack (run `npm run db:env`).");
  process.exit(1);
}

const admin = createClient(url, service, { auth: { persistSession: false } });
const ACCOUNTS = [
  { email: "owner.alpha@example.test", password: "Workshop2026new", name: "Hamid Ali", phone: "0300 1234567", role: "owner" },
  { email: "advisor.alpha@example.test", password: "Garage2026test", name: "Sana Iqbal", phone: "0301 2345678", role: "advisor" },
  { email: "mechanic.alpha@example.test", password: "Garage2026test", name: "Bilal Khan", phone: "0321 7654321", role: "mechanic" },
];

async function signIn({ email, password, name, phone }) {
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name, phone },
  });
  if (created.error && created.error.code !== "email_exists") throw created.error;
  const client = createClient(url, anon, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

const [owner, ...staff] = ACCOUNTS;
const ownerClient = await signIn(owner);
const { data: existing } = await ownerClient.from("workshops").select("id").eq("name", "Alpha Motors").maybeSingle();
const workshopId =
  existing?.id ??
  (await ownerClient.rpc("create_workshop", { p_name: "Alpha Motors", p_city: "Lahore", p_address: "12 Ferozepur Road" })).data;

for (const member of staff) {
  const client = await signIn(member);
  const { data: already } = await client.from("workshop_members").select("id").eq("workshop_id", workshopId).maybeSingle();
  if (already) continue;
  const invite = await ownerClient.rpc("create_invitation", { ws: workshopId, p_email: member.email, p_role: member.role });
  if (invite.error) throw invite.error;
  const accepted = await client.rpc("accept_invitation", { p_token: invite.data });
  if (accepted.error) throw accepted.error;
}

console.log("Seeded Alpha Motors with:");
for (const a of ACCOUNTS) console.log(`  ${a.role.padEnd(9)} ${a.email}  ${a.password}`);
