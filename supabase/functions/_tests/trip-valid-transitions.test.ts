/**
 * Integration tests for VALID ride-status transitions.
 *
 * Companion to `trip-transitions.test.ts` (which exercises invalid pairs).
 * Verifies the happy paths each lifecycle Edge Function accepts return 2xx
 * with the expected response shape:
 *
 *   - arrive-ride:   accepted   → arrived       (200, { success, ride_id })
 *   - start-ride:    accepted   → in_progress   (200, { success, ride_id, started_at })
 *   - start-ride:    arrived    → in_progress   (200, { success, ride_id, started_at })
 *   - complete-ride: in_progress → completed    (200, { success, ride_id, completed_at })
 *
 * All cases use the test driver (assigned + has `taxi` capability) and
 * `override_geofence: true` so the geofence guard does not interfere.
 *
 * Each test also verifies the underlying ride row was advanced to the
 * expected new status, catching any drift between the HTTP response and
 * the persisted state.
 */
import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  callFn,
  getTestDriverSession,
  type RideStatus,
  withSeededRide,
} from "./_helpers.ts";

// -----------------------------------------------------------------------------
// Helper: read the current ride status using the test-driver session.
// (Drivers can SELECT rides assigned to them via existing RLS policies.)
// -----------------------------------------------------------------------------
async function readRideStatus(rideId: string): Promise<string | null> {
  const session = await getTestDriverSession();
  const { data, error } = await session.client
    .from("rides")
    .select("status")
    .eq("id", rideId)
    .single();
  if (error) {
    throw new Error(`readRideStatus failed: ${error.message}`);
  }
  return (data?.status as string) ?? null;
}

function assertSuccessShape(
  body: Record<string, unknown>,
  rideId: string,
  extraKeys: string[] = [],
) {
  assertEquals(body.success, true, `expected success=true, got ${JSON.stringify(body)}`);
  assertEquals(body.ride_id, rideId, `expected ride_id=${rideId}, got ${JSON.stringify(body)}`);
  for (const key of extraKeys) {
    assert(
      body[key] != null,
      `expected '${key}' in response, got ${JSON.stringify(body)}`,
    );
  }
}

// -----------------------------------------------------------------------------
// arrive-ride: accepted → arrived
// -----------------------------------------------------------------------------
Deno.test("arrive-ride accepts 'accepted' → 'arrived' with 200", async () => {
  const session = await getTestDriverSession();
  await withSeededRide(
    {
      driver_id: session.profileId,
      service_type: "taxi",
      status: "accepted",
    },
    async ({ rideId }) => {
      const { status, body } = await callFn("arrive-ride", session.token, {
        ride_id: rideId,
        override_geofence: true,
      });
      assertEquals(status, 200, `body=${JSON.stringify(body)}`);
      assertSuccessShape(body, rideId);

      const newStatus = await readRideStatus(rideId);
      assertEquals(newStatus, "arrived", "ride row should be advanced to 'arrived'");
    },
  );
});

// -----------------------------------------------------------------------------
// start-ride: accepted → in_progress  AND  arrived → in_progress
// -----------------------------------------------------------------------------
const START_RIDE_VALID_FROM: RideStatus[] = ["accepted", "arrived"];

for (const from of START_RIDE_VALID_FROM) {
  Deno.test(
    `start-ride accepts '${from}' → 'in_progress' with 200`,
    async () => {
      const session = await getTestDriverSession();
      await withSeededRide(
        {
          driver_id: session.profileId,
          service_type: "taxi",
          status: from,
        },
        async ({ rideId }) => {
          const { status, body } = await callFn("start-ride", session.token, {
            ride_id: rideId,
            override_geofence: true,
          });
          assertEquals(status, 200, `body=${JSON.stringify(body)}`);
          assertSuccessShape(body, rideId, ["started_at"]);

          const newStatus = await readRideStatus(rideId);
          assertEquals(
            newStatus,
            "in_progress",
            "ride row should be advanced to 'in_progress'",
          );
        },
      );
    },
  );
}

// -----------------------------------------------------------------------------
// complete-ride: in_progress → completed
//
// Note: seeded rides have no stripe_payment_intent_id, so the in-app
// payment-capture branch is skipped — the 200 response is purely about
// the lifecycle transition.
// -----------------------------------------------------------------------------
Deno.test(
  "complete-ride accepts 'in_progress' → 'completed' with 200",
  async () => {
    const session = await getTestDriverSession();
    await withSeededRide(
      {
        driver_id: session.profileId,
        service_type: "taxi",
        status: "in_progress",
      },
      async ({ rideId }) => {
        const { status, body } = await callFn("complete-ride", session.token, {
          ride_id: rideId,
          distance_km: 1,
          duration_min: 5,
        });
        assertEquals(status, 200, `body=${JSON.stringify(body)}`);
        assertSuccessShape(body, rideId, ["completed_at"]);

        const newStatus = await readRideStatus(rideId);
        assertEquals(
          newStatus,
          "completed",
          "ride row should be advanced to 'completed'",
        );
      },
    );
  },
);
