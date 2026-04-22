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
 * Fixtures (rider/driver/ride) are created and torn down by `withSeededRide`
 * from `_helpers.ts`, which guarantees cleanup even when an assertion fails.
 */
import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  callFn,
  findOtherDriver,
  getTestDriverSession,
  type LifecycleFn,
  type RideStatus,
  withSeededRide,
} from "./_helpers.ts";

// -----------------------------------------------------------------------------
// Shared assertion helpers
// -----------------------------------------------------------------------------
function assertWrongDriver403(status: number, body: Record<string, unknown>) {
  assertEquals(status, 403, `body=${JSON.stringify(body)}`);
  assert(
    String(body.error ?? "").toLowerCase().includes("assigned driver"),
    `expected "assigned driver" error, got: ${JSON.stringify(body)}`,
  );
}

function assertServiceNotPermitted(
  status: number,
  body: Record<string, unknown>,
) {
  assertEquals(status, 403, `body=${JSON.stringify(body)}`);
  assertEquals(body.code, "service_not_permitted");
}

function lifecycleBody(fn: LifecycleFn, rideId: string) {
  if (fn === "complete-ride") {
    return { ride_id: rideId, distance_km: 1, duration_min: 5 };
  }
  return { ride_id: rideId, override_geofence: true };
}

// -----------------------------------------------------------------------------
// Wrong-driver matrix
// -----------------------------------------------------------------------------
const WRONG_DRIVER_CASES: Array<{ fn: LifecycleFn; status: RideStatus }> = [
  { fn: "arrive-ride", status: "accepted" },
  { fn: "start-ride", status: "accepted" },
  { fn: "complete-ride", status: "in_progress" },
];

for (const { fn, status: rideStatus } of WRONG_DRIVER_CASES) {
  Deno.test(`${fn} rejects wrong driver with 403`, async () => {
    const session = await getTestDriverSession();
    const otherDriver = await findOtherDriver(session);
    await withSeededRide(
      { driver_id: otherDriver, service_type: "taxi", status: rideStatus },
      async ({ rideId }) => {
        const { status, body } = await callFn(
          fn,
          session.token,
          lifecycleBody(fn, rideId),
        );
        assertWrongDriver403(status, body);
      },
    );
  });
}

// -----------------------------------------------------------------------------
// Capability gate matrix (service_not_permitted)
// -----------------------------------------------------------------------------
const CAPABILITY_CASES: Array<{ fn: LifecycleFn; status: RideStatus }> = [
  { fn: "arrive-ride", status: "accepted" },
  { fn: "start-ride", status: "accepted" },
  { fn: "complete-ride", status: "in_progress" },
];

for (const { fn, status: rideStatus } of CAPABILITY_CASES) {
  Deno.test(
    `${fn} rejects disallowed service_type with 403 service_not_permitted`,
    async () => {
      const session = await getTestDriverSession();
      await withSeededRide(
        {
          driver_id: session.profileId,
          service_type: "large_delivery",
          status: rideStatus,
        },
        async ({ rideId }) => {
          const { status, body } = await callFn(
            fn,
            session.token,
            lifecycleBody(fn, rideId),
          );
          assertServiceNotPermitted(status, body);
        },
      );
    },
  );
}
