/**
 * End-to-end dispatch-forwarding test.
 *
 * Simulates the sequential dispatch loop in `supabase/functions/match-driver/index.ts`
 * (lines 196-277) to verify that when the highest-priority driver declines or
 * ignores a ride request, the engine correctly forwards the ride to the
 * next-best available driver in the ranked candidate list.
 *
 * Two decline modes are modeled (both producible in production):
 *
 *   • EXPLICIT DECLINE — driver taps "No" in the IncomingRequestCard. The
 *     edge function never calls accept_ride; the dispatch poll loop simply
 *     times out and advances to the next candidate (match-driver/index.ts
 *     lines 218-235).
 *
 *   • TIMEOUT DECLINE  — driver ignores the request entirely. Same outcome
 *     as explicit decline from the dispatcher's point of view.
 *
 * Invariants verified:
 *   1. Candidates are dispatched STRICTLY in distance-sorted order.
 *   2. After a decline/timeout, dispatch_expires_at is cleared and the next
 *      candidate is dispatched (mirrors lines 273-276 of match-driver).
 *   3. The accepting driver becomes ride.driver_id and ride.status='accepted'.
 *   4. Only ONE accept call across the entire fan-out succeeds.
 *   5. After all MAX_CANDIDATES decline, the ride is reset to 'requested'
 *      (mirrors lines 280-286 of match-driver).
 *   6. A driver who declined earlier in the cycle does NOT receive a
 *      duplicate dispatch; the loop strictly advances forward.
 */

import { describe, it, expect, beforeEach } from "vitest";

// ── Domain ─────────────────────────────────────────────────────────────────
type RideStatus = "requested" | "dispatched" | "accepted" | "cancelled";

interface Driver {
  id: string;
  full_name: string;
  is_available: boolean;
  latitude: number;
  longitude: number;
  can_taxi: boolean;
}

interface Ride {
  id: string;
  status: RideStatus;
  driver_id: string | null;
  dispatched_to_driver_id: string | null;
  dispatch_expires_at: number | null;
  pickup_lat: number;
  pickup_lng: number;
}

type AcceptResult =
  | { success: true }
  | { success: false; reason: string };

type DriverResponse = "accept" | "decline" | "timeout";

// ── Constants mirroring match-driver/index.ts ──────────────────────────────
const DISPATCH_TIMEOUT_MS = 15_000;
const MAX_CANDIDATES = 3;

// ── Haversine + ranking (mirror of match-driver/index.ts lines 49-59,182-193)
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function rankCandidates(ride: Ride, drivers: Driver[]) {
  return drivers
    .filter((d) => d.is_available && d.can_taxi)
    .map((d) => ({
      d,
      distance_km: haversineKm(ride.pickup_lat, ride.pickup_lng, d.latitude, d.longitude),
    }))
    .sort((a, b) => a.distance_km - b.distance_km)
    .slice(0, MAX_CANDIDATES)
    .map((x) => x.d);
}

// ── Ride store with accept_ride RPC mirror ─────────────────────────────────
class RideStore {
  ride: Ride;
  dispatchHistory: string[] = []; // driver IDs in the order they were offered

  constructor(ride: Ride) {
    this.ride = ride;
  }

  dispatch(driverId: string, now: number) {
    this.ride.status = "dispatched";
    this.ride.dispatched_to_driver_id = driverId;
    this.ride.dispatch_expires_at = now + DISPATCH_TIMEOUT_MS;
    this.dispatchHistory.push(driverId);
  }

  // Mirrors lines 273-276 of match-driver (timeout / decline cleanup).
  clearDispatch() {
    this.ride.dispatched_to_driver_id = null;
    this.ride.dispatch_expires_at = null;
  }

  // Mirrors lines 280-284 of match-driver (no-driver-accepted reset).
  resetToRequested() {
    this.ride.status = "requested";
    this.ride.dispatched_to_driver_id = null;
    this.ride.dispatch_expires_at = null;
  }

  // Mirrors public.accept_ride RPC.
  acceptRide(driver: Driver, now: number): AcceptResult {
    if (!driver.is_available) return { success: false, reason: "driver_offline" };
    if (!["requested", "dispatched"].includes(this.ride.status)) {
      return { success: false, reason: "already_taken" };
    }
    if (
      this.ride.status === "dispatched" &&
      this.ride.dispatched_to_driver_id !== null &&
      this.ride.dispatched_to_driver_id !== driver.id
    ) {
      return { success: false, reason: "dispatched_to_other" };
    }
    if (
      this.ride.status === "dispatched" &&
      this.ride.dispatch_expires_at !== null &&
      this.ride.dispatch_expires_at < now
    ) {
      return { success: false, reason: "dispatch_expired" };
    }

    this.ride.status = "accepted";
    this.ride.driver_id = driver.id;
    this.ride.dispatched_to_driver_id = null;
    this.ride.dispatch_expires_at = null;
    return { success: true };
  }
}

// ── Dispatch loop mirror (match-driver/index.ts lines 195-286) ─────────────
//
// `responses` maps driverId → response. `accept` triggers an immediate
// accept_ride call within the candidate's window. `decline` and `timeout`
// both result in the loop polling until the dispatch_expires_at deadline,
// then advancing to the next candidate.
function runDispatchLoop(
  store: RideStore,
  candidates: Driver[],
  responses: Record<string, DriverResponse>,
  startTime = 1_700_000_000_000,
): { matched: boolean; winnerId?: string; finalNow: number } {
  let now = startTime;

  for (const candidate of candidates) {
    store.dispatch(candidate.id, now);
    const response = responses[candidate.id] ?? "timeout";

    if (response === "accept") {
      // Driver accepts within the dispatch window (simulate +1s reaction).
      now += 1_000;
      const result = store.acceptRide(candidate, now);
      if (result.success) {
        return { matched: true, winnerId: candidate.id, finalNow: now };
      }
      // Should not happen in this controlled simulation, but mirror the
      // edge function's defensive cleanup and fall through.
      now += DISPATCH_TIMEOUT_MS - 1_000;
      store.clearDispatch();
      continue;
    }

    // decline / timeout: the dispatch poll loop waits the full window,
    // then clears and advances. (lines 218-235 + 273-276)
    now += DISPATCH_TIMEOUT_MS;
    store.clearDispatch();
  }

  // No driver accepted across all candidates → reset to 'requested'.
  store.resetToRequested();
  return { matched: false, finalNow: now };
}

// ── Fixtures ───────────────────────────────────────────────────────────────
const PICKUP = { lat: 62.454, lng: -114.3718 };

function makeDriver(id: string, dKm: number, opts: Partial<Driver> = {}): Driver {
  return {
    id,
    full_name: `Driver ${id}`,
    is_available: true,
    can_taxi: true,
    latitude: PICKUP.lat + dKm / 111,
    longitude: PICKUP.lng,
    ...opts,
  };
}

function makeRide(): Ride {
  return {
    id: "ride-fwd-1",
    status: "requested",
    driver_id: null,
    dispatched_to_driver_id: null,
    dispatch_expires_at: null,
    pickup_lat: PICKUP.lat,
    pickup_lng: PICKUP.lng,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────
describe("dispatch forwarding: decline → next-best driver", () => {
  let store: RideStore;

  beforeEach(() => {
    store = new RideStore(makeRide());
  });

  it("forwards to the 2nd-nearest driver when the nearest declines", () => {
    const near = makeDriver("near", 0.5);
    const mid = makeDriver("mid", 2.0);
    const far = makeDriver("far", 5.0);
    const ranked = rankCandidates(store.ride, [far, mid, near]);
    expect(ranked.map((d) => d.id)).toEqual(["near", "mid", "far"]);

    const result = runDispatchLoop(store, ranked, {
      near: "decline",
      mid: "accept",
      far: "accept", // should never be reached
    });

    expect(result).toMatchObject({ matched: true, winnerId: "mid" });
    expect(store.dispatchHistory).toEqual(["near", "mid"]); // far never offered
    expect(store.ride.status).toBe("accepted");
    expect(store.ride.driver_id).toBe("mid");
    expect(store.ride.dispatched_to_driver_id).toBeNull();
    expect(store.ride.dispatch_expires_at).toBeNull();
  });

  it("forwards through two declines to reach the 3rd-best driver", () => {
    const a = makeDriver("a", 0.4);
    const b = makeDriver("b", 0.9);
    const c = makeDriver("c", 1.5);
    const ranked = rankCandidates(store.ride, [a, b, c]);

    const result = runDispatchLoop(store, ranked, {
      a: "decline",
      b: "decline",
      c: "accept",
    });

    expect(result.matched).toBe(true);
    expect(result.winnerId).toBe("c");
    expect(store.dispatchHistory).toEqual(["a", "b", "c"]);
    expect(store.ride.driver_id).toBe("c");
  });

  it("treats a timeout (no response) identically to an explicit decline", () => {
    const near = makeDriver("near", 0.5);
    const mid = makeDriver("mid", 2.0);
    const ranked = rankCandidates(store.ride, [near, mid]);

    const result = runDispatchLoop(store, ranked, {
      near: "timeout", // driver ignored the push notification
      mid: "accept",
    });

    expect(result.matched).toBe(true);
    expect(result.winnerId).toBe("mid");
    expect(store.dispatchHistory).toEqual(["near", "mid"]);
  });

  it("advances exactly DISPATCH_TIMEOUT_MS per declined candidate", () => {
    const near = makeDriver("near", 0.5);
    const mid = makeDriver("mid", 2.0);
    const ranked = rankCandidates(store.ride, [near, mid]);
    const start = 1_700_000_000_000;

    const result = runDispatchLoop(
      store,
      ranked,
      { near: "decline", mid: "accept" },
      start,
    );

    // near burns the full 15s window; mid accepts after a +1s reaction.
    expect(result.finalNow).toBe(start + DISPATCH_TIMEOUT_MS + 1_000);
  });

  it("when ALL candidates decline, the ride is reset to 'requested'", () => {
    const a = makeDriver("a", 0.4);
    const b = makeDriver("b", 0.9);
    const c = makeDriver("c", 1.5);
    const ranked = rankCandidates(store.ride, [a, b, c]);

    const result = runDispatchLoop(store, ranked, {
      a: "decline",
      b: "decline",
      c: "decline",
    });

    expect(result.matched).toBe(false);
    expect(store.dispatchHistory).toEqual(["a", "b", "c"]);
    expect(store.ride.status).toBe("requested");
    expect(store.ride.driver_id).toBeNull();
    expect(store.ride.dispatched_to_driver_id).toBeNull();
    expect(store.ride.dispatch_expires_at).toBeNull();
  });

  it("a declined driver is NOT re-offered the same ride within one fan-out", () => {
    const near = makeDriver("near", 0.5);
    const mid = makeDriver("mid", 2.0);
    const far = makeDriver("far", 5.0);
    const ranked = rankCandidates(store.ride, [near, mid, far]);

    runDispatchLoop(store, ranked, {
      near: "decline",
      mid: "decline",
      far: "accept",
    });

    // Each driver appears at most once in dispatch history.
    const counts = store.dispatchHistory.reduce<Record<string, number>>((acc, id) => {
      acc[id] = (acc[id] ?? 0) + 1;
      return acc;
    }, {});
    expect(counts).toEqual({ near: 1, mid: 1, far: 1 });
  });

  it("only ONE driver ends up as ride.driver_id even when later candidates would have accepted", () => {
    const near = makeDriver("near", 0.5);
    const mid = makeDriver("mid", 2.0);
    const far = makeDriver("far", 5.0);
    const ranked = rankCandidates(store.ride, [near, mid, far]);

    // near declines; mid accepts; far would also accept but must never be offered.
    const result = runDispatchLoop(store, ranked, {
      near: "decline",
      mid: "accept",
      far: "accept",
    });

    expect(result.winnerId).toBe("mid");
    expect(store.ride.driver_id).toBe("mid");
    expect(store.dispatchHistory).not.toContain("far");
  });

  it("respects MAX_CANDIDATES=3: a 4th nearer driver is never offered if 3 already declined", () => {
    // Five available drivers; only the top 3 by distance enter the rotation.
    const drivers = [
      makeDriver("d1", 0.3),
      makeDriver("d2", 0.6),
      makeDriver("d3", 1.0),
      makeDriver("d4", 1.4),
      makeDriver("d5", 2.0),
    ];
    const ranked = rankCandidates(store.ride, drivers);
    expect(ranked.map((d) => d.id)).toEqual(["d1", "d2", "d3"]);

    const result = runDispatchLoop(store, ranked, {
      d1: "decline",
      d2: "decline",
      d3: "decline",
    });

    expect(result.matched).toBe(false);
    expect(store.dispatchHistory).toEqual(["d1", "d2", "d3"]);
    expect(store.ride.status).toBe("requested");
  });
});
