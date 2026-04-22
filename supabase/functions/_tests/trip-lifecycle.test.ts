/**
 * Integration tests for trip-lifecycle edge functions:
 *  - arrive-ride
 *  - start-ride
 *  - complete-ride
 *
 * Verifies server-side authorization:
 *  1. A driver who is NOT the assigned driver gets 403.
 *  2. A driver who IS assigned but lacks the per-service capability
 *     (large_delivery requires SUV/truck/van) gets 403 with code
 *     "service_not_permitted".
 *
 * Test driver: testdriver@pickyou.test (can_taxi=true, vehicle_type='Sedan').
 *
 * Seeding strategy: uses psql (PG* env vars) to bypass RLS and the
 * prevent_duplicate_active_rides trigger isolation requirements.
 *
 * Run: tested via `lovable-exec test` / supabase test_edge_functions tool.
 */
import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY =
  Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ??
  Deno.env.get("VITE_SUPABASE_ANON_KEY")!;

const TEST_DRIVER_EMAIL = "testdriver@pickyou.test";
const TEST_DRIVER_PASSWORD = "Test1234!";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY");
}

// -----------------------------------------------------------------------------
// psql helper — uses PG* env vars to talk to the project DB directly.
// -----------------------------------------------------------------------------
async function psqlScalar(sql: string): Promise<string> {
  const cmd = new Deno.Command("psql", {
    args: ["-At", "-c", sql],
    stdout: "piped",
    stderr: "piped",
  });
  const { code, stdout, stderr } = await cmd.output();
  const out = new TextDecoder().decode(stdout).trim();
  const err = new TextDecoder().decode(stderr).trim();
  if (code !== 0) throw new Error(`psql failed: ${err || out}`);
  return out;
}

async function psqlExec(sql: string): Promise<void> {
  await psqlScalar(sql);
}

// -----------------------------------------------------------------------------
// Edge function caller
// -----------------------------------------------------------------------------
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

// -----------------------------------------------------------------------------
// Setup helpers
// -----------------------------------------------------------------------------
async function signInTestDriver(): Promise<{ token: string; profileId: string }> {
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { data, error } = await userClient.auth.signInWithPassword({
    email: TEST_DRIVER_EMAIL,
    password: TEST_DRIVER_PASSWORD,
  });
  if (error || !data.session) {
    throw new Error(`Failed to sign in test driver: ${error?.message}`);
  }
  const profileId = await psqlScalar(
    `SELECT id FROM public.profiles WHERE user_id = '${data.user!.id}' LIMIT 1;`,
  );
  if (!profileId) throw new Error("Test driver profile not found");
  return { token: data.session.access_token, profileId };
}

async function findOtherDriver(excludeProfileId: string): Promise<string> {
  const id = await psqlScalar(
    `SELECT id FROM public.profiles
     WHERE is_driver = true AND id <> '${excludeProfileId}'
     LIMIT 1;`,
  );
  if (!id) throw new Error("No other driver available for test");
  return id;
}

async function findIdleRider(): Promise<string> {
  const id = await psqlScalar(
    `SELECT p.id FROM public.profiles p
     WHERE p.is_rider = true
       AND NOT EXISTS (
         SELECT 1 FROM public.rides r
         WHERE r.rider_id = p.id
           AND r.status IN ('requested','accepted','arrived','in_progress')
       )
     LIMIT 1;`,
  );
  if (!id) throw new Error("No idle rider available for test");
  return id;
}

async function seedRide(opts: {
  rider_id: string;
  driver_id: string;
  service_type: "taxi" | "large_delivery";
  status: "accepted" | "in_progress";
}): Promise<string> {
  const id = await psqlScalar(
    `INSERT INTO public.rides (
       rider_id, driver_id, status, service_type,
       pickup_address, dropoff_address,
       pickup_lat, pickup_lng, dropoff_lat, dropoff_lng,
       payment_option, pricing_model
     ) VALUES (
       '${opts.rider_id}', '${opts.driver_id}', '${opts.status}', '${opts.service_type}',
       'TEST PICKUP', 'TEST DROPOFF',
       62.454, -114.371, 62.46, -114.38,
       'in_app', 'metered'
     ) RETURNING id;`,
  );
  if (!id) throw new Error("Failed to seed test ride");
  return id;
}

async function deleteRide(rideId: string) {
  await psqlExec(`DELETE FROM public.ride_events WHERE ride_id = '${rideId}';`);
  await psqlExec(`DELETE FROM public.rides WHERE id = '${rideId}';`);
}

// -----------------------------------------------------------------------------
// Tests — wrong driver
// -----------------------------------------------------------------------------
Deno.test("arrive-ride rejects wrong driver with 403", async () => {
  const { token, profileId } = await signInTestDriver();
  const otherDriver = await findOtherDriver(profileId);
  const rider = await findIdleRider();
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
    assertEquals(status, 403, `body=${JSON.stringify(body)}`);
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
  const rider = await findIdleRider();
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
    assertEquals(status, 403, `body=${JSON.stringify(body)}`);
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
  const rider = await findIdleRider();
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
    assertEquals(status, 403, `body=${JSON.stringify(body)}`);
    assert(
      String(body.error ?? "").toLowerCase().includes("assigned driver"),
      `expected "assigned driver" error, got: ${JSON.stringify(body)}`,
    );
  } finally {
    await deleteRide(rideId);
  }
});

// -----------------------------------------------------------------------------
// Tests — capability gate (service_not_permitted)
// -----------------------------------------------------------------------------
Deno.test("arrive-ride rejects disallowed service_type with 403 service_not_permitted", async () => {
  const { token, profileId } = await signInTestDriver();
  const rider = await findIdleRider();
  const rideId = await seedRide({
    rider_id: rider,
    driver_id: profileId,
    service_type: "large_delivery",
    status: "accepted",
  });
  try {
    const { status, body } = await callFn("arrive-ride", token, {
      ride_id: rideId,
      override_geofence: true,
    });
    assertEquals(status, 403, `body=${JSON.stringify(body)}`);
    assertEquals(body.code, "service_not_permitted");
  } finally {
    await deleteRide(rideId);
  }
});

Deno.test("start-ride rejects disallowed service_type with 403 service_not_permitted", async () => {
  const { token, profileId } = await signInTestDriver();
  const rider = await findIdleRider();
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
    assertEquals(status, 403, `body=${JSON.stringify(body)}`);
    assertEquals(body.code, "service_not_permitted");
  } finally {
    await deleteRide(rideId);
  }
});

Deno.test("complete-ride rejects disallowed service_type with 403 service_not_permitted", async () => {
  const { token, profileId } = await signInTestDriver();
  const rider = await findIdleRider();
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
    assertEquals(status, 403, `body=${JSON.stringify(body)}`);
    assertEquals(body.code, "service_not_permitted");
  } finally {
    await deleteRide(rideId);
  }
});
