/**
 * Integration tests for trip-lifecycle edge functions:
 *  - arrive-ride
 *  - start-ride
 *  - complete-ride
 *
 * Asserts server-side authorization:
 *  1. A driver who is NOT the assigned driver gets 403.
 *  2. A driver who IS assigned but lacks the per-service capability
 *     (large_delivery requires SUV/truck/van; test driver has Sedan)
 *     gets 403 with code "service_not_permitted".
 *
 * Test driver: testdriver@pickyou.test (can_taxi=true, vehicle_type='Sedan').
 *
 * Seed/cleanup uses two SECURITY DEFINER RPCs (`_test_seed_lifecycle_ride`,
 * `_test_cleanup_lifecycle_ride`) that are restricted to the test driver
 * account, so the test runner needs only an authenticated session — no
 * service-role key, no psql.
 */
import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

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
// Auth + helpers
// -----------------------------------------------------------------------------
interface DriverSession {
  client: SupabaseClient;
  token: string;
  userId: string;
  profileId: string;
}

async function signInTestDriver(): Promise<DriverSession> {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email: TEST_DRIVER_EMAIL,
    password: TEST_DRIVER_PASSWORD,
  });
  if (error || !data.session) {
    throw new Error(`Failed to sign in test driver: ${error?.message}`);
  }
  const { data: profile, error: profErr } = await client
    .from("profiles")
    .select("id")
    .eq("user_id", data.user!.id)
    .single();
  if (profErr || !profile) {
    throw new Error(`Profile lookup failed: ${profErr?.message}`);
  }
  return {
    client,
    token: data.session.access_token,
    userId: data.user!.id,
    profileId: profile.id as string,
  };
}

async function findOtherDriver(session: DriverSession): Promise<string> {
  const { data, error } = await session.client.rpc("_test_find_other_driver");
  if (error || !data) {
    throw new Error(`findOtherDriver failed: ${error?.message ?? "no id"}`);
  }
  return data as string;
}

async function seedRide(
  session: DriverSession,
  opts: {
    driver_id: string;
    service_type: "taxi" | "large_delivery";
    status: "accepted" | "in_progress";
  },
): Promise<string> {
  const { data, error } = await session.client.rpc("_test_seed_lifecycle_ride", {
    _driver_id: opts.driver_id,
    _service_type: opts.service_type,
    _status: opts.status,
  });
  if (error || !data) {
    throw new Error(`seedRide failed: ${error?.message ?? "no id returned"}`);
  }
  return data as string;
}

async function cleanupRide(session: DriverSession, rideId: string) {
  const { error } = await session.client.rpc("_test_cleanup_lifecycle_ride", {
    _ride_id: rideId,
  });
  if (error) {
    // eslint-disable-next-line no-console
    console.warn(`cleanup warn for ride ${rideId}: ${error.message}`);
  }
}

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
// Tests — wrong driver rejected with 403
// -----------------------------------------------------------------------------
Deno.test("arrive-ride rejects wrong driver with 403", async () => {
  const session = await signInTestDriver();
  const otherDriver = await findOtherDriver(session);
  const rideId = await seedRide(session, {
    driver_id: otherDriver,
    service_type: "taxi",
    status: "accepted",
  });
  try {
    const { status, body } = await callFn("arrive-ride", session.token, {
      ride_id: rideId,
      override_geofence: true,
    });
    assertEquals(status, 403, `body=${JSON.stringify(body)}`);
    assert(
      String(body.error ?? "").toLowerCase().includes("assigned driver"),
      `expected "assigned driver" error, got: ${JSON.stringify(body)}`,
    );
  } finally {
    await cleanupRide(session, rideId);
  }
});

Deno.test("start-ride rejects wrong driver with 403", async () => {
  const session = await signInTestDriver();
  const otherDriver = await findOtherDriver(session);
  const rideId = await seedRide(session, {
    driver_id: otherDriver,
    service_type: "taxi",
    status: "accepted",
  });
  try {
    const { status, body } = await callFn("start-ride", session.token, {
      ride_id: rideId,
      override_geofence: true,
    });
    assertEquals(status, 403, `body=${JSON.stringify(body)}`);
    assert(
      String(body.error ?? "").toLowerCase().includes("assigned driver"),
      `expected "assigned driver" error, got: ${JSON.stringify(body)}`,
    );
  } finally {
    await cleanupRide(session, rideId);
  }
});

Deno.test("complete-ride rejects wrong driver with 403", async () => {
  const session = await signInTestDriver();
  const otherDriver = await findOtherDriver(session);
  const rideId = await seedRide(session, {
    driver_id: otherDriver,
    service_type: "taxi",
    status: "in_progress",
  });
  try {
    const { status, body } = await callFn("complete-ride", session.token, {
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
    await cleanupRide(session, rideId);
  }
});

// -----------------------------------------------------------------------------
// Tests — capability gate (service_not_permitted)
// -----------------------------------------------------------------------------
Deno.test("arrive-ride rejects disallowed service_type with 403 service_not_permitted", async () => {
  const session = await signInTestDriver();
  const rideId = await seedRide(session, {
    driver_id: session.profileId,
    service_type: "large_delivery",
    status: "accepted",
  });
  try {
    const { status, body } = await callFn("arrive-ride", session.token, {
      ride_id: rideId,
      override_geofence: true,
    });
    assertEquals(status, 403, `body=${JSON.stringify(body)}`);
    assertEquals(body.code, "service_not_permitted");
  } finally {
    await cleanupRide(session, rideId);
  }
});

Deno.test("start-ride rejects disallowed service_type with 403 service_not_permitted", async () => {
  const session = await signInTestDriver();
  const rideId = await seedRide(session, {
    driver_id: session.profileId,
    service_type: "large_delivery",
    status: "accepted",
  });
  try {
    const { status, body } = await callFn("start-ride", session.token, {
      ride_id: rideId,
      override_geofence: true,
    });
    assertEquals(status, 403, `body=${JSON.stringify(body)}`);
    assertEquals(body.code, "service_not_permitted");
  } finally {
    await cleanupRide(session, rideId);
  }
});

Deno.test("complete-ride rejects disallowed service_type with 403 service_not_permitted", async () => {
  const session = await signInTestDriver();
  const rideId = await seedRide(session, {
    driver_id: session.profileId,
    service_type: "large_delivery",
    status: "in_progress",
  });
  try {
    const { status, body } = await callFn("complete-ride", session.token, {
      ride_id: rideId,
      distance_km: 1,
      duration_min: 5,
    });
    assertEquals(status, 403, `body=${JSON.stringify(body)}`);
    assertEquals(body.code, "service_not_permitted");
  } finally {
    await cleanupRide(session, rideId);
  }
});
