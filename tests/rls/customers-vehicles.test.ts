import { beforeAll, describe, expect, it } from "vitest";
import { permissionsFor, ROLES } from "@/lib/auth/permissions";
import { normalizePhone, normalizeRegistration } from "@/lib/phone";
import { PHONE_SAMPLES, REGISTRATION_SAMPLES } from "@/lib/phone.fixtures";
import { addMember, admin, createWorkshop, run, userClient, type Client, type TestUser } from "./helpers";

let ownerA: TestUser;
let advisorA: TestUser;
let inventoryA: TestUser;
let cashierA: TestUser;
let ownerB: TestUser;
let wsA: string;
let wsB: string;

function addCustomer(client: Client, ws: string, name: string, phone: string, sharedPhone = false) {
  return client
    .from("customers")
    .insert({ workshop_id: ws, name, phone, shared_phone_confirmed: sharedPhone })
    .select("id, code, phone_normalized")
    .single();
}

async function mustAddCustomer(client: Client, ws: string, name: string, phone: string) {
  const res = await addCustomer(client, ws, name, phone);
  if (res.error) throw res.error;
  return res.data;
}

function addVehicle(client: Client, ws: string, customerId: string, registration: string, reason?: string) {
  return client
    .from("vehicles")
    .insert({
      workshop_id: ws,
      customer_id: customerId,
      registration_number: registration,
      make: "Toyota",
      model: "Corolla",
      duplicate_registration_reason: reason ?? null,
    })
    .select("id")
    .single();
}

async function countByPhone(ws: string, phone: string) {
  const { count } = await admin
    .from("customers")
    .select("id", { count: "exact", head: true })
    .eq("workshop_id", ws)
    .eq("phone_normalized", normalizePhone(phone)!);
  return count;
}

beforeAll(async () => {
  [ownerA, advisorA, inventoryA, cashierA, ownerB] = await Promise.all([
    userClient("p2-owner-a"),
    userClient("p2-advisor-a"),
    userClient("p2-inventory-a"),
    userClient("p2-cashier-a"),
    userClient("p2-owner-b"),
  ]);
  wsA = await createWorkshop(ownerA.client, `Alpha ${run}`);
  wsB = await createWorkshop(ownerB.client, `Bravo ${run}`);
  await addMember(ownerA.client, wsA, advisorA, "advisor");
  await addMember(ownerA.client, wsA, inventoryA, "inventory_manager");
  await addMember(ownerA.client, wsA, cashierA, "cashier");
});

describe("database and app agree", () => {
  it("on the role → permission matrix", async () => {
    const { data, error } = await advisorA.client.from("role_permissions").select("role, permission");
    expect(error).toBeNull();
    for (const role of ROLES) {
      const db = data!.filter((r) => r.role === role).map((r) => r.permission).sort();
      expect(db, role).toEqual([...permissionsFor(role)].sort());
    }
  });

  it("on phone normalisation", async () => {
    for (const [input, expected] of PHONE_SAMPLES) {
      const { data } = await advisorA.client.rpc("normalize_phone", { p: input });
      expect(data, input).toBe(expected);
      expect(normalizePhone(input), input).toBe(expected);
    }
  });

  it("on registration normalisation", async () => {
    for (const plate of REGISTRATION_SAMPLES) {
      const { data } = await advisorA.client.rpc("normalize_registration", { p: plate });
      expect(data, plate).toBe(normalizeRegistration(plate));
    }
  });
});

describe("duplicate phone numbers are caught before save (Phase 2 gate)", () => {
  it("rejects the same number written differently", async () => {
    await mustAddCustomer(advisorA.client, wsA, "Asif Khan", "0300 1112233");
    for (const variant of ["+92 300 111 2233", "923001112233", "0300-1112233", "3001112233"]) {
      const res = await addCustomer(advisorA.client, wsA, "Someone Else", variant);
      expect(res.error?.message, variant).toBe("duplicate_phone");
    }
    expect(await countByPhone(wsA, "0300 1112233")).toBe(1);
  });

  it("rejects changing a customer's phone to a number that's taken", async () => {
    const other = await mustAddCustomer(advisorA.client, wsA, "Bilal Ahmed", "0321 4445566");
    const res = await advisorA.client.from("customers").update({ phone: "+923001112233" }).eq("id", other.id);
    expect(res.error?.message).toBe("duplicate_phone");
  });

  it("allows a shared family number only with explicit confirmation, and logs it", async () => {
    const res = await addCustomer(advisorA.client, wsA, "Asif's son", "0300 1112233", true);
    expect(res.error).toBeNull();
    const log = await ownerA.client
      .from("activity_logs")
      .select("action")
      .eq("entity_id", res.data!.id)
      .eq("action", "customer.shared_phone_confirmed");
    expect(log.data).toHaveLength(1);
  });

  it("lets two simultaneous saves of a new number through only once", async () => {
    const results = await Promise.all([
      addCustomer(advisorA.client, wsA, "Race One", "0333 9990001"),
      addCustomer(ownerA.client, wsA, "Race Two", "+92 333 9990001"),
    ]);
    expect(results.filter((r) => r.error === null)).toHaveLength(1);
    expect(results.find((r) => r.error)?.error?.message).toBe("duplicate_phone");
    expect(await countByPhone(wsA, "0333 9990001")).toBe(1);
  });

  it("allows the same number in a different workshop", async () => {
    const res = await addCustomer(ownerB.client, wsB, "Unrelated person", "0300 1112233");
    expect(res.error).toBeNull();
  });
});

describe("customer records", () => {
  it("numbers customers per workshop without gaps from rejected saves", async () => {
    const ws = await createWorkshop(ownerB.client, `Numbering ${run}`);
    const first = await mustAddCustomer(ownerB.client, ws, "First", "0300 0000001");
    const rejected = await addCustomer(ownerB.client, ws, "Duplicate", "0300 0000001");
    const second = await mustAddCustomer(ownerB.client, ws, "Second", "0300 0000002");
    expect(rejected.error).not.toBeNull();
    expect([first.code, second.code]).toEqual(["C-0001", "C-0002"]);
  });

  it("does not let a client choose its own customer code", async () => {
    const res = await advisorA.client
      .from("customers")
      .insert({ workshop_id: wsA, name: "Code Picker", phone: "0300 5550000", code: "C-9999" });
    expect(res.error).not.toBeNull();
  });

  it("lets only the owner archive a customer", async () => {
    const c = await mustAddCustomer(advisorA.client, wsA, "To Archive", "0300 5550001");
    const byAdvisor = await advisorA.client.from("customers").update({ archived_at: new Date().toISOString() }).eq("id", c.id);
    expect(byAdvisor.error).not.toBeNull();
    const byOwner = await ownerA.client.from("customers").update({ archived_at: new Date().toISOString() }).eq("id", c.id).select("id");
    expect(byOwner.error).toBeNull();
    expect(byOwner.data).toHaveLength(1);
  });

  it("finds customers by partial phone in any format, and by name", async () => {
    const byPhone = await advisorA.client.rpc("search_customers", { ws: wsA, q: "0300 111" });
    expect(byPhone.data?.map((c) => c.name)).toEqual(expect.arrayContaining(["Asif Khan", "Asif's son"]));
    const byName = await advisorA.client.rpc("search_customers", { ws: wsA, q: "bilal" });
    expect(byName.data?.map((c) => c.name)).toEqual(["Bilal Ahmed"]);
  });

  it("doesn't treat a customer code as a partial phone number", async () => {
    const res = await advisorA.client.rpc("search_customers", { ws: wsA, q: "C-0001" });
    expect(res.data?.map((c) => c.code)).toEqual(["C-0001"]);
  });

  it("treats % and _ in a search as plain text", async () => {
    for (const q of ["%", "_", "\\"]) {
      const res = await advisorA.client.rpc("search_customers", { ws: wsA, q });
      expect(res.data, q).toEqual([]);
    }
  });
});

describe("roles", () => {
  it("hides customers from the inventory manager", async () => {
    const res = await inventoryA.client.from("customers").select("id").eq("workshop_id", wsA);
    expect(res.data).toEqual([]);
  });

  it("lets the cashier read customers but not add them", async () => {
    const read = await cashierA.client.from("customers").select("id").eq("workshop_id", wsA);
    expect(read.data?.length).toBeGreaterThan(0);
    const write = await addCustomer(cashierA.client, wsA, "Cashier Added", "0300 5550002");
    expect(write.error).not.toBeNull();
  });
});

describe("tenant isolation for customers and vehicles", () => {
  let customerA: string;
  let vehicleA: string;

  beforeAll(async () => {
    customerA = (await mustAddCustomer(advisorA.client, wsA, "Private Customer", "0300 7778899")).id;
    const v = await addVehicle(advisorA.client, wsA, customerA, "ISB-7788");
    if (v.error) throw v.error;
    vehicleA = v.data.id;
    const r = await advisorA.client.from("vehicle_mileage_readings").insert({ workshop_id: wsA, vehicle_id: vehicleA, reading: 1000 });
    if (r.error) throw r.error;
  });

  it("hides another workshop's customers, vehicles and mileage", async () => {
    const reads = await Promise.all([
      ownerB.client.from("customers").select("id").eq("id", customerA),
      ownerB.client.from("vehicles").select("id").eq("id", vehicleA),
      ownerB.client.from("vehicle_mileage_readings").select("id").eq("vehicle_id", vehicleA),
      ownerB.client.rpc("search_customers", { ws: wsA }),
      ownerB.client.rpc("search_vehicles", { ws: wsA }),
    ]);
    for (const r of reads) expect(r.data).toEqual([]);
  });

  it("blocks writing into another workshop", async () => {
    const insert = await addCustomer(ownerB.client, wsA, "Intruder", "0300 1231234");
    expect(insert.error).not.toBeNull();
    const update = await ownerB.client.from("customers").update({ name: "Hijacked" }).eq("id", customerA).select("id");
    expect(update.data ?? []).toEqual([]);
    const reading = await ownerB.client.from("vehicle_mileage_readings").insert({ workshop_id: wsA, vehicle_id: vehicleA, reading: 5 });
    expect(reading.error).not.toBeNull();
  });

  it("blocks linking a vehicle to another workshop's customer", async () => {
    const res = await addVehicle(ownerB.client, wsB, customerA, "KHI-1111");
    expect(res.error).not.toBeNull();
    const transfer = await advisorA.client.from("vehicles").update({ customer_id: customerA }).eq("id", vehicleA);
    expect(transfer.error).toBeNull(); // same workshop: fine
  });
});

describe("vehicles", () => {
  let owner1: string;
  let owner2: string;
  let corolla: string;

  beforeAll(async () => {
    owner1 = (await mustAddCustomer(advisorA.client, wsA, "Vehicle Owner One", "0345 1000001")).id;
    owner2 = (await mustAddCustomer(advisorA.client, wsA, "Vehicle Owner Two", "0345 1000002")).id;
    const v = await addVehicle(advisorA.client, wsA, owner1, "LEA-1234");
    if (v.error) throw v.error;
    corolla = v.data.id;
  });

  it("rejects a duplicate registration written differently", async () => {
    const res = await addVehicle(advisorA.client, wsA, owner2, "lea 1234");
    expect(res.error?.message).toBe("duplicate_registration");
  });

  it("allows a duplicate registration only for the owner, with a reason", async () => {
    expect((await addVehicle(advisorA.client, wsA, owner2, "LEA1234", "Plate reissued")).error?.message).toBe("duplicate_registration");
    expect((await addVehicle(ownerA.client, wsA, owner2, "LEA1234")).error?.message).toBe("duplicate_registration");
    const ok = await addVehicle(ownerA.client, wsA, owner2, "LEA1234", "Plate reissued by excise office");
    expect(ok.error).toBeNull();
    const log = await ownerA.client
      .from("activity_logs")
      .select("metadata")
      .eq("entity_id", ok.data!.id)
      .eq("action", "vehicle.duplicate_registration_allowed");
    expect(log.data).toHaveLength(1);
  });

  it("records ownership transfers", async () => {
    const res = await advisorA.client.from("vehicles").update({ customer_id: owner2 }).eq("id", corolla);
    expect(res.error).toBeNull();
    const log = await ownerA.client
      .from("activity_logs")
      .select("metadata")
      .eq("entity_id", corolla)
      .eq("action", "vehicle.transferred")
      .single();
    expect(log.data?.metadata).toEqual({ from: owner1, to: owner2 });
  });

  it("keeps mileage history append-only and questions a lower reading", async () => {
    const add = (reading: number, note?: string) =>
      advisorA.client.from("vehicle_mileage_readings").insert({ workshop_id: wsA, vehicle_id: corolla, reading, note: note ?? null }).select("id").single();

    const first = await add(50000);
    expect(first.error).toBeNull();
    expect((await add(40000)).error?.message).toBe("mileage_decrease");
    expect((await add(40000, "Odometer replaced")).error).toBeNull();
    expect((await add(45000)).error).toBeNull();

    const edit = await ownerA.client.from("vehicle_mileage_readings").update({ reading: 1 }).eq("id", first.data!.id);
    expect(edit.error).not.toBeNull();
    const del = await ownerA.client.from("vehicle_mileage_readings").delete().eq("id", first.data!.id);
    expect(del.error).not.toBeNull();
    const { data } = await admin.from("vehicle_mileage_readings").select("reading").eq("vehicle_id", corolla).order("recorded_at");
    expect(data?.map((r) => r.reading)).toEqual([50000, 40000, 45000]);
  });

  it("finds vehicles by plate in any format and shows current mileage", async () => {
    const res = await advisorA.client.rpc("search_vehicles", { ws: wsA, q: "Lea 1234" });
    const match = res.data?.find((v) => v.id === corolla);
    expect(match?.current_mileage).toBe(45000);
    expect(match?.customer_name).toBe("Vehicle Owner Two");
  });
});
