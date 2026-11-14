import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";

config({ path: [".env.local", ".env.test.local"], quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceKey) {
  throw new Error("Run `npm run db:env` with local Supabase running to create .env.local");
}

const PASSWORD = "Test-password-123!";
const run = randomUUID().slice(0, 8);
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

function anonClient() {
  return createClient(url!, anonKey!, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function userClient(label: string) {
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

async function createWorkshop(client: SupabaseClient, name: string) {
  const { data, error } = await client.rpc("create_workshop", { p_name: name });
  if (error) throw error;
  return data as string;
}

let ownerA: Awaited<ReturnType<typeof userClient>>;
let ownerB: Awaited<ReturnType<typeof userClient>>;
let mechanicA: Awaited<ReturnType<typeof userClient>>;
let wsA: string;
let wsB: string;

beforeAll(async () => {
  [ownerA, ownerB, mechanicA] = await Promise.all([
    userClient("owner-a"),
    userClient("owner-b"),
    userClient("mechanic-a"),
  ]);
  wsA = await createWorkshop(ownerA.client, `Alpha Motors ${run}`);
  wsB = await createWorkshop(ownerB.client, `Bravo Autos ${run}`);

  const invite = await ownerA.client.rpc("create_invitation", {
    ws: wsA,
    p_email: mechanicA.email,
    p_role: "mechanic",
  });
  if (invite.error) throw invite.error;
  const accepted = await mechanicA.client.rpc("accept_invitation", { p_token: invite.data });
  if (accepted.error) throw accepted.error;
});

// Positive controls: the same operations the isolation tests expect to fail must
// succeed inside the user's own workshop, so a failure above means "blocked", not "broken".
describe("owners can work inside their own workshop", () => {
  it("reads its members, invitations and activity", async () => {
    const members = await ownerA.client.from("workshop_members").select("id").eq("workshop_id", wsA);
    const invites = await ownerA.client.from("workshop_invitations").select("id").eq("workshop_id", wsA);
    const logs = await ownerA.client.from("activity_logs").select("id").eq("workshop_id", wsA);
    expect(members.data?.length).toBe(2);
    expect(invites.data?.length).toBe(1);
    expect(logs.data?.length).toBeGreaterThan(0);
  });

  it("updates its own workshop", async () => {
    const res = await ownerA.client.from("workshops").update({ city: "Lahore" }).eq("id", wsA).select("city");
    expect(res.error).toBeNull();
    expect(res.data).toEqual([{ city: "Lahore" }]);
  });

  it("writes to its own activity log", async () => {
    const res = await ownerA.client.from("activity_logs").insert({
      workshop_id: wsA,
      actor_id: ownerA.id,
      entity_type: "workshop",
      action: "test.ping",
    });
    expect(res.error).toBeNull();
  });

  it("reads a co-worker's profile", async () => {
    const res = await ownerA.client.from("profiles").select("email").eq("id", mechanicA.id);
    expect(res.data).toEqual([{ email: mechanicA.email }]);
  });
});

describe("tenant isolation between two workshops", () => {
  it("each owner sees only their own workshop", async () => {
    const a = await ownerA.client.from("workshops").select("id");
    const b = await ownerB.client.from("workshops").select("id");
    expect(a.data?.map((w) => w.id)).toEqual([wsA]);
    expect(b.data?.map((w) => w.id)).toEqual([wsB]);
  });

  it("hides the other workshop's rows in every table", async () => {
    const workshop = await ownerA.client.from("workshops").select("id").eq("id", wsB);
    const members = await ownerA.client.from("workshop_members").select("id").eq("workshop_id", wsB);
    const invites = await ownerA.client.from("workshop_invitations").select("id").eq("workshop_id", wsB);
    const logs = await ownerA.client.from("activity_logs").select("id").eq("workshop_id", wsB);
    const profile = await ownerA.client.from("profiles").select("id").eq("id", ownerB.id);
    for (const result of [workshop, members, invites, logs, profile]) {
      expect(result.error).toBeNull();
      expect(result.data).toEqual([]);
    }
  });

  it("blocks updating the other workshop", async () => {
    const res = await ownerA.client.from("workshops").update({ name: "Hijacked" }).eq("id", wsB).select("id");
    expect(res.data ?? []).toEqual([]);
    const check = await admin.from("workshops").select("name").eq("id", wsB).single();
    expect(check.data?.name).toBe(`Bravo Autos ${run}`);
  });

  it("blocks inviting people into the other workshop", async () => {
    const res = await ownerA.client.rpc("create_invitation", {
      ws: wsB,
      p_email: `intruder-${run}@example.test`,
      p_role: "advisor",
    });
    expect(res.error).not.toBeNull();
  });

  it("blocks adding yourself as a member of the other workshop", async () => {
    const res = await ownerA.client
      .from("workshop_members")
      .insert({ workshop_id: wsB, user_id: ownerA.id, role: "owner" });
    expect(res.error).not.toBeNull();
  });

  it("blocks writing activity into the other workshop's log", async () => {
    const res = await ownerA.client.from("activity_logs").insert({
      workshop_id: wsB,
      actor_id: ownerA.id,
      entity_type: "workshop",
      action: "forged",
    });
    expect(res.error).not.toBeNull();
  });

  it("rejects accepting an invitation sent to someone else", async () => {
    const invite = await ownerB.client.rpc("create_invitation", {
      ws: wsB,
      p_email: `someone-${run}@example.test`,
      p_role: "advisor",
    });
    expect(invite.error).toBeNull();
    const res = await ownerA.client.rpc("accept_invitation", { p_token: invite.data });
    expect(res.error).not.toBeNull();
    const members = await admin.from("workshop_members").select("id").eq("workshop_id", wsB).eq("user_id", ownerA.id);
    expect(members.data).toEqual([]);
  });

  it("gives anonymous visitors no table access", async () => {
    const res = await anonClient().from("workshops").select("id");
    expect(res.data ?? []).toEqual([]);
  });
});

describe("roles inside one workshop", () => {
  it("lets the mechanic see their workshop but not its activity log", async () => {
    const ws = await mechanicA.client.from("workshops").select("id");
    expect(ws.data?.map((w) => w.id)).toEqual([wsA]);
    const logs = await mechanicA.client.from("activity_logs").select("id").eq("workshop_id", wsA);
    expect(logs.data).toEqual([]);
  });

  it("blocks the mechanic from changing workshop settings", async () => {
    const res = await mechanicA.client.from("workshops").update({ tax_rate: 99 }).eq("id", wsA).select("id");
    expect(res.data ?? []).toEqual([]);
  });

  it("blocks the mechanic from inviting staff or promoting themselves", async () => {
    const invite = await mechanicA.client.rpc("create_invitation", {
      ws: wsA,
      p_email: `friend-${run}@example.test`,
      p_role: "cashier",
    });
    expect(invite.error).not.toBeNull();
    const promote = await mechanicA.client
      .from("workshop_members")
      .update({ role: "owner" })
      .eq("workshop_id", wsA)
      .eq("user_id", mechanicA.id)
      .select("id");
    expect(promote.data ?? []).toEqual([]);
  });

  it("prevents moving a membership to another workshop", async () => {
    const res = await ownerA.client
      .from("workshop_members")
      .update({ workshop_id: wsB })
      .eq("user_id", mechanicA.id);
    expect(res.error).not.toBeNull();
  });

  it("keeps at least one active owner", async () => {
    const res = await ownerA.client
      .from("workshop_members")
      .update({ role: "advisor" })
      .eq("workshop_id", wsA)
      .eq("user_id", ownerA.id);
    expect(res.error?.message).toMatch(/at least one active owner/);
  });

  it("records role changes in the activity log", async () => {
    const res = await ownerA.client
      .from("workshop_members")
      .update({ role: "advisor" })
      .eq("workshop_id", wsA)
      .eq("user_id", mechanicA.id);
    expect(res.error).toBeNull();
    const logs = await ownerA.client
      .from("activity_logs")
      .select("action")
      .eq("workshop_id", wsA)
      .eq("action", "member.role_changed");
    expect(logs.data?.length).toBe(1);
  });
});
