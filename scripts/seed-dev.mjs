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
  const { data: me } = await client.auth.getUser();
  const { data: already } = await client
    .from("workshop_members")
    .select("id")
    .eq("workshop_id", workshopId)
    .eq("user_id", me.user.id)
    .maybeSingle();
  if (already) continue;
  const invite = await ownerClient.rpc("create_invitation", { ws: workshopId, p_email: member.email, p_role: member.role });
  if (invite.error) throw invite.error;
  const accepted = await client.rpc("accept_invitation", { p_token: invite.data });
  if (accepted.error) throw accepted.error;
}

// Sample catalogue, customer, vehicle and a checked-in job (each only once).
// Bulk inserts must give every row the same keys, or PostgREST sends null for missing ones.
async function seedOnce(table, rows) {
  const { count } = await ownerClient.from(table).select("id", { count: "exact", head: true }).eq("workshop_id", workshopId);
  if (count) return;
  const { error } = await ownerClient.from(table).insert(rows.map((r) => ({ workshop_id: workshopId, ...r })));
  if (error) throw error;
}
await seedOnce("labour_items", [
  { name: "Oil and filter change", default_price: 1500, estimated_minutes: 30 },
  { name: "Brake service (per axle)", default_price: 2500, estimated_minutes: 60 },
  { name: "AC gas refill", default_price: 4500, estimated_minutes: 45 },
  { name: "Wheel alignment", default_price: 1800, estimated_minutes: 40 },
]);
await seedOnce("parts", [
  { name: "Engine oil 4L (5W-30)", brand: "Shell", part_number: null, selling_price: 7800, cost_price: 6900, unit: "can" },
  { name: "Oil filter", brand: "Toyota Genuine", part_number: "90915-YZZE1", selling_price: 950, cost_price: 700, unit: "piece" },
  { name: "Front brake pads", brand: "Bosch", part_number: null, selling_price: 6000, cost_price: 4800, unit: "set" },
]);

let { data: vehicle } = await ownerClient.from("vehicles").select("id").eq("workshop_id", workshopId).eq("registration_normalized", "LEC2468").maybeSingle();
if (!vehicle) {
  const { data: customer } = await ownerClient
    .from("customers")
    .insert({ workshop_id: workshopId, name: "Usman Tariq", phone: "0301 5551234", whatsapp: "0301 5551234" })
    .select("id")
    .single();
  ({ data: vehicle } = await ownerClient
    .from("vehicles")
    .insert({ workshop_id: workshopId, customer_id: customer.id, registration_number: "LEC-2468", make: "Toyota", model: "Corolla", variant: "GLi", year: 2017, colour: "Silver" })
    .select("id")
    .single());
  await ownerClient.rpc("create_job_card", {
    ws: workshopId,
    p_vehicle: vehicle.id,
    p_complaint: "Squealing when braking, AC not cooling well",
    p_mileage: 98500,
    p_fuel_level: "half",
  });
}

console.log("Seeded Alpha Motors with:");
for (const a of ACCOUNTS) console.log(`  ${a.role.padEnd(9)} ${a.email}  ${a.password}`);
console.log("  sample: customer Usman Tariq, vehicle LEC-2468 with a checked-in job, labour and parts catalogue");
