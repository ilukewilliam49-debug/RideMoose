/**
 * Integration tests for invalid ride-status transitions.
 *
 * Verifies that arrive-ride / start-ride / complete-ride reject calls made
 * from a ride status that the function does not allow, returning a 400 with
 * a clear "Cannot ... from '<status>'" error message.
 *
 * Allowed transitions (must NOT be tested as invalid here):
 *   - arrive-ride:   accepted   → arrived
 *   - start-ride:    accepted   → in_progress
 *                    arrived    → in_progress
 *   - complete-ride: in_progress → completed
 *
 * Every other (status, fn) pair is exercised below and asserted to fail.
 *
 * The test driver is the assigned driver and possesses the `taxi` capability,
 * so neither the wrong-driver nor the capability gate fires — we isolate the
 * status-transition guard.
 */
import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  callFn,
  getTestDriverSession,
  type LifecycleFn,
  type RideStatus,
  withSeededRide,
} from "./_helpers.ts";

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------
function lifecycleBody(fn: LifecycleFn, rideId: string) {
  if (fn === "complete-ride") {
    return { ride_id: rideId, distance_km: 1, duration_min: 5 };
  }
  return { ride_id: rideId, override_geofence: true };
}

function expectedActionPhrase(fn: LifecycleFn): string {
  switch (fn) {
    case "arrive-ride":
      return "cannot mark arrived";
    case "start-ride":
      return "cannot start ride";
    case "complete-ride":
      return "cannot complete ride";
  }
}

function assertInvalidTransition(
  fn: LifecycleFn,
  fromStatus: RideStatus,
  status: number,
  body: Record<string, unknown>,
) {
  assertEquals(
    status,
    400,
    `[${fn} from ${fromStatus}] expected 400, got ${status}: ${
      JSON.stringify(body)
    }`,
  );
  const err = String(body.error ?? "").toLowerCase();
  assert(
    err.includes(expectedActionPhrase(fn)),
    `[${fn} from ${fromStatus}] error should mention "${
      expectedActionPhrase(fn)
    }", got: ${JSON.stringify(body)}`,
  );
  assert(
    err.includes(`'${fromStatus}'`),
    `[${fn} from ${fromStatus}] error should reference status '${fromStatus}', got: ${
      JSON.stringify(body)
    }`,
  );
}

// -----------------------------------------------------------------------------
// Invalid-transition matrix
//
// Statuses we can safely seed via _test_seed_lifecycle_ride: any value in the
// ride_status enum. We pick the set of states that exercise each guard without
// duplicating the *valid* transitions (which are covered elsewhere).
// -----------------------------------------------------------------------------
const INVALID_TRANSITIONS: Array<{ fn: LifecycleFn; from: RideStatus }> = [
  // arrive-ride only allows `accepted`
  { fn: "arrive-ride", from: "requested" },
  { fn: "arrive-ride", from: "arrived" },
  { fn: "arrive-ride", from: "in_progress" },
  { fn: "arrive-ride", from: "completed" },
  { fn: "arrive-ride", from: "cancelled" },

  // start-ride allows `accepted` and `arrived`
  { fn: "start-ride", from: "requested" },
  { fn: "start-ride", from: "in_progress" },
  { fn: "start-ride", from: "completed" },
  { fn: "start-ride", from: "cancelled" },

  // complete-ride only allows `in_progress`
  { fn: "complete-ride", from: "requested" },
  { fn: "complete-ride", from: "accepted" },
  { fn: "complete-ride", from: "arrived" },
  { fn: "complete-ride", from: "completed" },
  { fn: "complete-ride", from: "cancelled" },
];

for (const { fn, from } of INVALID_TRANSITIONS) {
  Deno.test(
    `${fn} rejects invalid transition from '${from}' with 400`,
    async () => {
      const session = await getTestDriverSession();
      await withSeededRide(
        {
          driver_id: session.profileId,
          service_type: "taxi",
          status: from,
        },
        async ({ rideId }) => {
          const { status, body } = await callFn(
            fn,
            session.token,
            lifecycleBody(fn, rideId),
          );
          assertInvalidTransition(fn, from, status, body);
        },
      );
    },
  );
}
