/**
 * Integration tests for trip-lifecycle edge functions:
 *  - arrive-ride
 *  - start-ride
 *  - complete-ride
 *
 * Verifies server-side authorization:
 *  1. A driver who is NOT the assigned driver gets 403.
 *  2. A driver who IS assigned but lacks the per-service capability gets 403
 *     with code "service_not_permitted".
 *
 * Test driver: testdriver@pickyou.test (has can_taxi=true, vehicle_type='Sedan',
 * so they cannot serve large_delivery — perfect for capability test).
 */
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import {
  assertEquals,
  assert,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const TEST_DRIVER_EMAIL = "testdriver@pickyou.test";
const TEST_DRIVER_PASSWORD = "Test1234!";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_KEY) {
  throw new Error(
    "Missing env: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY",
  );
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

async function callFn(
  fn: "arrive-ride" | "start-ride" | "complete-ride",
  token: string,
  body: Record<string, unknown>,
) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json as Record<string, unknown> };
}

async function signInTestDriver(): Promise<{ token: string; profileId: string }> {
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await userClient.auth.signInWithPassword({
    email: TEST_DRIVER_EMAIL,
    password: TEST_DRIVER_PASSWORD,
  });
  if (error || !data.session) {
    throw new Error(`Failed to sign in test driver: ${error?.message}`);
  }
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("user_id", data.user!.id)
    .single();
  if (!profile) throw new Error("Test driver profile not found");
  return { token: data.session.access_token, profileId: profile.id as string };
}

/**
 * Find an "other" driver profile (NOT the test driver) to use as the
 * assigned driver_id, so the test driver becomes a "wrong driver".
 */
async function findOtherDriver(excludeProfileId: string): Promise<string> {
  const { data, error } = await admin
    .from("profiles")
    .select("id")
    .eq("is_driver", true)
    .neq("id", excludeProfileId)
    .limit(1);
  if (error || !data?.[0]) throw new Error("No other driver available for test");
  return data[0].id as string;
}

/**
 * Find a rider profile to own the synthetic ride.
 */
async function findRider(): Promise<string> {
  const { data, error } = await admin
    .from("profiles")
    .select("id")
    .eq("is_rider", true)
    .limit(1);
  if (error || !data?.[0]) throw new Error("No rider profile available for test");
  return data[0].id as string;
}

/**
 * Insert a synthetic ride row directly via service role. Bypasses
 * the prevent_duplicate_active_rides trigger by using a freshly-found
 * rider that has no active rides — and we clean up at the end.
 */
async function seedRide(opts: {
  rider_id: string;
  driver_id: string;
  service_type: "taxi" | "large_delivery";
  status: "accepted" | "in_progress";
}): Promise<string> {
  // Pick a rider with no active ride
  const { data: riders } = await admin
    .from("profiles")
    .select("id")
    .eq("is_rider", true)
    .limit(20);
  let usableRider: string | null = null;
  for (const r of riders ?? []) {
    const { data: active } = await admin
      .from("rides")
      .select("id")
      .eq("rider_id", r.id)
      .in("status", ["requested", "accepted", "arrived", "in_progress"])
      .limit(1);
    if (!active || active.length === 0) {
      usableRider = r.id as string;
      break;
    }
  }
  if (!usableRider) {
    throw new Error("No rider without an active ride available for seeding");
  }

  const { data, error } = await admin
    .from("rides")
    .insert({
      rider_id: usableRider,
      driver_id: opts.driver_id,
      status: opts.status,
      service_type: opts.service_type,
      pickup_address: "TEST PICKUP",
      dropoff_address: "TEST DROPOFF",
      pickup_lat: 62.454,
      pickup_lng: -114.371,
      dropoff_lat: 62.46,
      dropoff_lng: -114.38,
      payment_option: "in_app",
      pricing_model: "metered",
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Failed to seed ride: ${error?.message}`);
  return data.id as string;
}

async function deleteRide(rideId: string) {
  // ride_events FK references rides — delete dependent rows first
  await admin.from("ride_events").delete().eq("ride_id", rideId);
  await admin.from("rides").delete().eq("id", rideId);
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

Deno.test("arrive-ride rejects wrong driver with 403", async () => {
  const { token, profileId } = await signInTestDriver();
  const otherDriver = await findOtherDriver(profileId);
  const rider = await findRider();
  const rideId = await seedRide({
    rider_id: rider,
    driver_id: otherDriver,
    service_type: "taxi",
    status: "accepted",
  });
  try {
    const { status, body } = await callFn("arrive-ride", token, {
      ride_id: rideId,
      override_geofence: true,
    });
    assertEquals(status, 403, `expected 403, got ${status} body=${JSON.stringify(body)}`);
    assert(
      String(body.error ?? "").toLowerCase().includes("assigned driver"),
      `expected "assigned driver" error, got: ${JSON.stringify(body)}`,
    );
  } finally {
    await deleteRide(rideId);
  }
});

Deno.test("start-ride rejects wrong driver with 403", async () => {
  const { token, profileId } = await signInTestDriver();
  const otherDriver = await findOtherDriver(profileId);
  const rider = await findRider();
  const rideId = await seedRide({
    rider_id: rider,
    driver_id: otherDriver,
    service_type: "taxi",
    status: "accepted",
  });
  try {
    const { status, body } = await callFn("start-ride", token, {
      ride_id: rideId,
      override_geofence: true,
    });
    assertEquals(status, 403, `expected 403, got ${status} body=${JSON.stringify(body)}`);
    assert(
      String(body.error ?? "").toLowerCase().includes("assigned driver"),
      `expected "assigned driver" error, got: ${JSON.stringify(body)}`,
    );
  } finally {
    await deleteRide(rideId);
  }
});

Deno.test("complete-ride rejects wrong driver with 403", async () => {
  const { token, profileId } = await signInTestDriver();
  const otherDriver = await findOtherDriver(profileId);
  const rider = await findRider();
  const rideId = await seedRide({
    rider_id: rider,
    driver_id: otherDriver,
    service_type: "taxi",
    status: "in_progress",
  });
  try {
    const { status, body } = await callFn("complete-ride", token, {
      ride_id: rideId,
      distance_km: 1,
      duration_min: 5,
    });
    assertEquals(status, 403, `expected 403, got ${status} body=${JSON.stringify(body)}`);
    assert(
      String(body.error ?? "").toLowerCase().includes("assigned driver"),
      `expected "assigned driver" error, got: ${JSON.stringify(body)}`,
    );
  } finally {
    await deleteRide(rideId);
  }
});

Deno.test("arrive-ride rejects disallowed service_type with 403 service_not_permitted", async () => {
  // Test driver has can_taxi=true but vehicle_type='Sedan' — cannot serve large_delivery.
  const { token, profileId } = await signInTestDriver();
  const rider = await findRider();
  const rideId = await seedRide({
    rider_id: rider,
    driver_id: profileId, // assign to test driver so we hit the capability check
    service_type: "large_delivery",
    status: "accepted",
  });
  try {
    const { status, body } = await callFn("arrive-ride", token, {
      ride_id: rideId,
      override_geofence: true,
    });
    assertEquals(status, 403, `expected 403, got ${status} body=${JSON.stringify(body)}`);
    assertEquals(body.code, "service_not_permitted");
  } finally {
    await deleteRide(rideId);
  }
});

Deno.test("start-ride rejects disallowed service_type with 403 service_not_permitted", async () => {
  const { token, profileId } = await signInTestDriver();
  const rider = await findRider();
  const rideId = await seedRide({
    rider_id: rider,
    driver_id: profileId,
    service_type: "large_delivery",
    status: "accepted",
  });
  try {
    const { status, body } = await callFn("start-ride", token, {
      ride_id: rideId,
      override_geofence: true,
    });
    assertEquals(status, 403, `expected 403, got ${status} body=${JSON.stringify(body)}`);
    assertEquals(body.code, "service_not_permitted");
  } finally {
    await deleteRide(rideId);
  }
});

Deno.test("complete-ride rejects disallowed service_type with 403 service_not_permitted", async () => {
  const { token, profileId } = await signInTestDriver();
  const rider = await findRider();
  const rideId = await seedRide({
    rider_id: rider,
    driver_id: profileId,
    service_type: "large_delivery",
    status: "in_progress",
  });
  try {
    const { status, body } = await callFn("complete-ride", token, {
      ride_id: rideId,
      distance_km: 1,
      duration_min: 5,
    });
    assertEquals(status, 403, `expected 403, got ${status} body=${JSON.stringify(body)}`);
    assertEquals(body.code, "service_not_permitted");
  } finally {
    await deleteRide(rideId);
  }
});
