/**
 * Shared test helpers for Edge Function integration tests.
 *
 * Goals:
 *  - Centralize test-driver auth, ride seeding, cleanup, and fn invocation.
 *  - Guarantee that fixtures (seeded rides) are torn down even when an
 *    assertion throws inside the test body.
 *  - Make individual test files small, focused, and deterministic.
 *
 * The cleanup contract uses `withSeededRide` / `withFixtures`: the user-supplied
 * test body runs inside a try/finally, so even an `assert` failure won't leak
 * synthetic rides into the database.
 *
 * Auth model: a single shared test driver account
 * (`testdriver@pickyou.test`) authorized via two SECURITY DEFINER RPCs
 * (`_test_seed_lifecycle_ride`, `_test_cleanup_lifecycle_ride`) — no
 * service-role key is needed.
 */
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import {
  createClient,
  type SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2";

// -----------------------------------------------------------------------------
// Env + constants
// -----------------------------------------------------------------------------
export const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
export const SUPABASE_ANON_KEY =
  Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ??
  Deno.env.get("VITE_SUPABASE_ANON_KEY")!;

export const TEST_DRIVER_EMAIL = "testdriver@pickyou.test";
export const TEST_DRIVER_PASSWORD = "Test1234!";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY");
}

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------
export type ServiceType =
  | "taxi"
  | "private_hire"
  | "courier"
  | "retail_delivery"
  | "personal_shopper"
  | "large_delivery"
  | "shuttle";

export type RideStatus =
  | "requested"
  | "dispatched"
  | "accepted"
  | "arrived"
  | "in_progress"
  | "completed"
  | "cancelled";

export type LifecycleFn = "arrive-ride" | "start-ride" | "complete-ride";

export interface DriverSession {
  client: SupabaseClient;
  token: string;
  userId: string;
  /** profiles.id (NOT auth.users.id) for the test driver. */
  profileId: string;
}

export interface SeedRideOpts {
  driver_id: string;
  service_type: ServiceType;
  status: RideStatus;
}

export interface FnResponse {
  status: number;
  body: Record<string, unknown>;
}

// -----------------------------------------------------------------------------
// Session caching — sign in once per test run
// -----------------------------------------------------------------------------
let _cachedSession: Promise<DriverSession> | null = null;

/**
 * Sign in (or return the cached) test-driver session.
 * Subsequent calls reuse the same JWT to keep tests fast.
 */
export function getTestDriverSession(): Promise<DriverSession> {
  if (!_cachedSession) {
    _cachedSession = (async () => {
      const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await client.auth.signInWithPassword({
        email: TEST_DRIVER_EMAIL,
        password: TEST_DRIVER_PASSWORD,
      });
      if (error || !data.session) {
        throw new Error(
          `Failed to sign in test driver: ${error?.message ?? "no session"}`,
        );
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
    })();
  }
  return _cachedSession;
}

// -----------------------------------------------------------------------------
// Fixture primitives
// -----------------------------------------------------------------------------
export async function findOtherDriver(session: DriverSession): Promise<string> {
  const { data, error } = await session.client.rpc("_test_find_other_driver");
  if (error || !data) {
    throw new Error(`findOtherDriver failed: ${error?.message ?? "no id"}`);
  }
  return data as string;
}

export async function seedRide(
  session: DriverSession,
  opts: SeedRideOpts,
): Promise<string> {
  const { data, error } = await session.client.rpc(
    "_test_seed_lifecycle_ride",
    {
      _driver_id: opts.driver_id,
      _service_type: opts.service_type,
      _status: opts.status,
    },
  );
  if (error || !data) {
    throw new Error(`seedRide failed: ${error?.message ?? "no id returned"}`);
  }
  return data as string;
}

export async function cleanupRide(
  session: DriverSession,
  rideId: string,
): Promise<void> {
  const { error } = await session.client.rpc("_test_cleanup_lifecycle_ride", {
    _ride_id: rideId,
  });
  if (error) {
    // eslint-disable-next-line no-console
    console.warn(`cleanup warn for ride ${rideId}: ${error.message}`);
  }
}

// -----------------------------------------------------------------------------
// Edge Function invocation
// -----------------------------------------------------------------------------
export async function callFn(
  fn: LifecycleFn,
  token: string,
  body: Record<string, unknown>,
): Promise<FnResponse> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  });
  // Always consume the body to prevent Deno resource leaks.
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    json = { raw: text };
  }
  return { status: res.status, body: json };
}

// -----------------------------------------------------------------------------
// Fixture wrappers — guaranteed teardown via try/finally
// -----------------------------------------------------------------------------

/**
 * Seed a ride, run `body`, then clean up the ride — even if `body` throws
 * (e.g. an assertion failure). Use this in every lifecycle test instead of
 * an inline try/finally.
 *
 * Example:
 *   await withSeededRide(
 *     { driver_id: session.profileId, service_type: "taxi", status: "accepted" },
 *     async ({ rideId, session }) => {
 *       const { status } = await callFn("arrive-ride", session.token, {
 *         ride_id: rideId, override_geofence: true,
 *       });
 *       assertEquals(status, 200);
 *     },
 *   );
 */
export async function withSeededRide(
  opts: SeedRideOpts,
  body: (ctx: { rideId: string; session: DriverSession }) => Promise<void>,
): Promise<void> {
  const session = await getTestDriverSession();
  const rideId = await seedRide(session, opts);
  try {
    await body({ rideId, session });
  } finally {
    await cleanupRide(session, rideId);
  }
}

/**
 * Generalized fixture wrapper for tests that need multiple seeded rides
 * or other resources. Each `setup` returns a cleanup callback that is
 * guaranteed to run in reverse order in the `finally` block.
 *
 * Example:
 *   await withFixtures(
 *     async () => {
 *       const session = await getTestDriverSession();
 *       const ride = await seedRide(session, { ... });
 *       return {
 *         value: { session, ride },
 *         cleanup: () => cleanupRide(session, ride),
 *       };
 *     },
 *     async ({ session, ride }) => { ... assertions ... },
 *   );
 */
export interface Fixture<T> {
  value: T;
  cleanup: () => Promise<void> | void;
}

export async function withFixtures<T>(
  setup: () => Promise<Fixture<T>>,
  body: (value: T) => Promise<void>,
): Promise<void> {
  const fixture = await setup();
  try {
    await body(fixture.value);
  } finally {
    try {
      await fixture.cleanup();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`fixture cleanup warn: ${(err as Error).message}`);
    }
  }
}
