/**
 * Geofence enforcement tests for `arrive-ride`.
 *
 * The function rejects arrival attempts when the driver is more than
 * ARRIVE_GEOFENCE_METERS (500m) from the ride's pickup point, unless
 * `override_geofence: true` is supplied.
 *
 * NOTE: The function intentionally returns HTTP 400 (with
 * `code: "too_far_from_pickup"`) for geofence rejections — not 403 —
 * because the request is well-formed and the caller is authorized;
 * the issue is a transient pre-condition (driver location) that the
 * driver can fix by moving closer. These tests assert the actual
 * contract.
 */
import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  callFn,
  getTestDriverSession,
  withSeededRide,
} from "./_helpers.ts";

// Seeded ride pickup is (62.454, -114.371) — see _test_seed_lifecycle_ride.
// A point ~7km north is well outside the 500m geofence.
const FAR_LAT = 62.520;
const FAR_LNG = -114.371;
// A point ~10m north of pickup is well inside the geofence.
const NEAR_LAT = 62.45409;
const NEAR_LNG = -114.371;

Deno.test(
  "arrive-ride: rejects with 400 + too_far_from_pickup when driver is outside geofence",
  async () => {
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
          driver_lat: FAR_LAT,
          driver_lng: FAR_LNG,
          override_geofence: false,
        });

        assertEquals(status, 400);
        assertEquals(body.code, "too_far_from_pickup");
        assert(typeof body.distance_m === "number");
        assert(
          (body.distance_m as number) > 500,
          `expected distance > 500m, got ${body.distance_m}`,
        );
        assert(
          typeof body.error === "string" &&
            (body.error as string).includes("from pickup"),
          `expected error mentioning pickup distance, got: ${body.error}`,
        );
      },
    );
  },
);

Deno.test(
  "arrive-ride: rejects when override_geofence is omitted and driver is far away",
  async () => {
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
          driver_lat: FAR_LAT,
          driver_lng: FAR_LNG,
          // override_geofence intentionally omitted — defaults to false
        });

        assertEquals(status, 400);
        assertEquals(body.code, "too_far_from_pickup");
      },
    );
  },
);

Deno.test(
  "arrive-ride: accepts with 200 when driver is inside geofence (no override needed)",
  async () => {
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
          driver_lat: NEAR_LAT,
          driver_lng: NEAR_LNG,
          override_geofence: false,
        });

        assertEquals(status, 200);
        assertEquals(body.success, true);
        assertEquals(body.ride_id, rideId);
      },
    );
  },
);

Deno.test(
  "arrive-ride: override_geofence=true bypasses the distance check",
  async () => {
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
          driver_lat: FAR_LAT,
          driver_lng: FAR_LNG,
          override_geofence: true,
        });

        assertEquals(status, 200);
        assertEquals(body.success, true);
      },
    );
  },
);
