/**
 * E2E test: push-notification targeting during a sequential dispatch fan-out.
 *
 * Mirrors the dispatch loop in `supabase/functions/match-driver/index.ts`
 * (lines 195-286) and the per-candidate push notification call to
 * `send-push-notification` (mode=`ride_dispatched`, target_profile_id=<driver>).
 *
 * Invariants verified for a single ride fan-out:
 *
 *   1. EXACTLY ONE push is sent per dispatch hop (no broadcast / fan-out spam).
 *   2. The push always targets the CURRENTLY dispatched driver — i.e. the
 *      driver written to `rides.dispatched_to_driver_id` at the moment of send.
 *   3. A driver who DECLINED or TIMED OUT earlier in the same fan-out never
 *      receives a subsequent invite for the same ride within that fan-out.
 *   4. Drivers BEHIND the current candidate in the ranked queue receive no
 *      push until the loop advances to them.
 *   5. Once a driver ACCEPTS, no further pushes are sent (loop exits).
 *   6. If all candidates decline, the total push count equals the number of
 *      candidates offered (= 3 for MAX_CANDIDATES), with no duplicates.
 */

import { describe, it, expect, beforeEach } from "vitest";

// ── Domain ─────────────────────────────────────────────────────────────────
type RideStatus = "requested" | "dispatched" | "accepted" | "cancelled";

interface Driver {
  id: string;
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

interface PushEvent {
  ride_id: string;
  target_profile_id: string;
  event: "ride_dispatched";
  sent_at: number;
}

type DriverResponse = "accept" | "decline" | "timeout";

const DISPATCH_TIMEOUT_MS = 15_000;
const MAX_CANDIDATES = 3;

// ── Haversine + ranking ────────────────────────────────────────────────────
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

// ── Push notification spy (mirror of send-push-notification call) ──────────
class PushNotifier {
  events: PushEvent[] = [];

  send(ride: Ride, targetDriverId: string, now: number) {
    // Production rule: send-push-notification is invoked AFTER the rides row
    // has been updated with dispatched_to_driver_id. We assert that here so
    // the spy refuses to record a push that targets a driver who is NOT the
    // currently dispatched one.
    if (ride.dispatched_to_driver_id !== targetDriverId) {
      throw new Error(
        `Refused to send push to ${targetDriverId}: current dispatch is ${ride.dispatched_to_driver_id}`,
      );
    }
    this.events.push({
      ride_id: ride.id,
      target_profile_id: targetDriverId,
      event: "ride_dispatched",
      sent_at: now,
    });
  }

  pushesFor(driverId: string) {
    return this.events.filter((e) => e.target_profile_id === driverId);
  }

  recipientsInOrder() {
    return this.events.map((e) => e.target_profile_id);
  }
}

// ── Ride store + dispatch loop ─────────────────────────────────────────────
class RideStore {
  ride: Ride;
  constructor(ride: Ride) {
    this.ride = ride;
  }

  dispatch(driverId: string, now: number) {
    this.ride.status = "dispatched";
    this.ride.dispatched_to_driver_id = driverId;
    this.ride.dispatch_expires_at = now + DISPATCH_TIMEOUT_MS;
  }

  clearDispatch() {
    this.ride.dispatched_to_driver_id = null;
    this.ride.dispatch_expires_at = null;
  }

  resetToRequested() {
    this.ride.status = "requested";
    this.ride.dispatched_to_driver_id = null;
    this.ride.dispatch_expires_at = null;
  }

  acceptRide(driver: Driver) {
    if (
      this.ride.status === "dispatched" &&
      this.ride.dispatched_to_driver_id !== driver.id
    ) {
      return { success: false, reason: "dispatched_to_other" } as const;
    }
    this.ride.status = "accepted";
    this.ride.driver_id = driver.id;
    this.ride.dispatched_to_driver_id = null;
    this.ride.dispatch_expires_at = null;
    return { success: true } as const;
  }
}

function runDispatchLoop(
  store: RideStore,
  candidates: Driver[],
  responses: Record<string, DriverResponse>,
  push: PushNotifier,
  startTime = 1_700_000_000_000,
): { matched: boolean; winnerId?: string } {
  let now = startTime;

  for (const candidate of candidates) {
    store.dispatch(candidate.id, now);
    // Production: edge function calls send-push-notification immediately
    // after writing dispatched_to_driver_id.
    push.send(store.ride, candidate.id, now);

    const response = responses[candidate.id] ?? "timeout";

    if (response === "accept") {
      now += 1_000;
      const result = store.acceptRide(candidate);
      if (result.success) return { matched: true, winnerId: candidate.id };
    }

    // decline or timeout: burn the window and advance.
    now += DISPATCH_TIMEOUT_MS;
    store.clearDispatch();
  }

  store.resetToRequested();
  return { matched: false };
}

// ── Fixtures ───────────────────────────────────────────────────────────────
const PICKUP = { lat: 62.454, lng: -114.3718 };

function makeDriver(id: string, dKm: number): Driver {
  return {
    id,
    is_available: true,
    can_taxi: true,
    latitude: PICKUP.lat + dKm / 111,
    longitude: PICKUP.lng,
  };
}

function makeRide(): Ride {
  return {
    id: "ride-push-1",
    status: "requested",
    driver_id: null,
    dispatched_to_driver_id: null,
    dispatch_expires_at: null,
    pickup_lat: PICKUP.lat,
    pickup_lng: PICKUP.lng,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────
describe("dispatch fan-out: push notifications target only the current driver", () => {
  let store: RideStore;
  let push: PushNotifier;

  beforeEach(() => {
    store = new RideStore(makeRide());
    push = new PushNotifier();
  });

  it("sends exactly one push per dispatch hop, addressed to the currently dispatched driver", () => {
    const a = makeDriver("a", 0.4);
    const b = makeDriver("b", 0.9);
    const c = makeDriver("c", 1.5);
    const ranked = rankCandidates(store.ride, [a, b, c]);

    runDispatchLoop(store, ranked, { a: "decline", b: "decline", c: "accept" }, push);

    // Three hops → three pushes, in distance-ranked order.
    expect(push.events.length).toBe(3);
    expect(push.recipientsInOrder()).toEqual(["a", "b", "c"]);
    // Each hop targeted exactly one driver.
    expect(push.pushesFor("a")).toHaveLength(1);
    expect(push.pushesFor("b")).toHaveLength(1);
    expect(push.pushesFor("c")).toHaveLength(1);
  });

  it("does NOT push the previously declined driver again within the same fan-out", () => {
    const near = makeDriver("near", 0.5);
    const mid = makeDriver("mid", 2.0);
    const far = makeDriver("far", 5.0);
    const ranked = rankCandidates(store.ride, [near, mid, far]);

    runDispatchLoop(store, ranked, { near: "decline", mid: "accept" }, push);

    // 'near' got exactly one push (the original invite) and never another.
    expect(push.pushesFor("near")).toHaveLength(1);
    // 'mid' got exactly one push (the forwarded invite).
    expect(push.pushesFor("mid")).toHaveLength(1);
    // 'far' was never offered → never pushed.
    expect(push.pushesFor("far")).toHaveLength(0);
  });

  it("stops sending pushes immediately after a driver accepts", () => {
    const a = makeDriver("a", 0.4);
    const b = makeDriver("b", 0.9);
    const c = makeDriver("c", 1.5);
    const ranked = rankCandidates(store.ride, [a, b, c]);

    // 'a' accepts on the first hop; 'b' and 'c' must never be pushed.
    runDispatchLoop(store, ranked, { a: "accept", b: "accept", c: "accept" }, push);

    expect(push.events.length).toBe(1);
    expect(push.events[0].target_profile_id).toBe("a");
    expect(push.pushesFor("b")).toHaveLength(0);
    expect(push.pushesFor("c")).toHaveLength(0);
  });

  it("treats timeout identically to decline: no follow-up push to the silent driver", () => {
    const near = makeDriver("near", 0.5);
    const mid = makeDriver("mid", 2.0);
    const ranked = rankCandidates(store.ride, [near, mid]);

    runDispatchLoop(store, ranked, { near: "timeout", mid: "accept" }, push);

    expect(push.pushesFor("near")).toHaveLength(1); // initial only
    expect(push.pushesFor("mid")).toHaveLength(1);
    expect(push.recipientsInOrder()).toEqual(["near", "mid"]);
  });

  it("when all candidates decline, exactly MAX_CANDIDATES pushes are sent with no duplicates", () => {
    const a = makeDriver("a", 0.4);
    const b = makeDriver("b", 0.9);
    const c = makeDriver("c", 1.5);
    const ranked = rankCandidates(store.ride, [a, b, c]);

    const result = runDispatchLoop(
      store,
      ranked,
      { a: "decline", b: "decline", c: "decline" },
      push,
    );

    expect(result.matched).toBe(false);
    expect(push.events.length).toBe(MAX_CANDIDATES);
    // Every recipient appears exactly once.
    const counts = push.recipientsInOrder().reduce<Record<string, number>>((acc, id) => {
      acc[id] = (acc[id] ?? 0) + 1;
      return acc;
    }, {});
    expect(counts).toEqual({ a: 1, b: 1, c: 1 });
  });

  it("each push is sent strictly AFTER dispatched_to_driver_id is set to that driver", () => {
    // The PushNotifier.send() guard throws if the ride row doesn't already
    // identify the target as the current dispatch. If any push were sent
    // out-of-order (e.g. to a previously declined driver, or to a future
    // candidate before the loop advanced), this run would throw.
    const a = makeDriver("a", 0.4);
    const b = makeDriver("b", 0.9);
    const ranked = rankCandidates(store.ride, [a, b]);

    expect(() =>
      runDispatchLoop(store, ranked, { a: "decline", b: "accept" }, push),
    ).not.toThrow();

    // Sanity: timestamps are monotonically increasing across hops.
    expect(push.events[1].sent_at).toBeGreaterThan(push.events[0].sent_at);
  });

  it("pushes are temporally separated by at least DISPATCH_TIMEOUT_MS between declines", () => {
    const a = makeDriver("a", 0.4);
    const b = makeDriver("b", 0.9);
    const ranked = rankCandidates(store.ride, [a, b]);

    runDispatchLoop(store, ranked, { a: "decline", b: "accept" }, push);

    const gap = push.events[1].sent_at - push.events[0].sent_at;
    expect(gap).toBe(DISPATCH_TIMEOUT_MS);
  });

  it("a driver further down the queue receives NO push until the loop reaches them", () => {
    const a = makeDriver("a", 0.4);
    const b = makeDriver("b", 0.9);
    const c = makeDriver("c", 1.5);
    const ranked = rankCandidates(store.ride, [a, b, c]);

    // 'a' accepts on hop 1.
    runDispatchLoop(store, ranked, { a: "accept" }, push);

    // 'b' and 'c' are behind 'a' → no push for them at all.
    expect(push.pushesFor("b")).toHaveLength(0);
    expect(push.pushesFor("c")).toHaveLength(0);
    // And if we replay with 'a' declining → both eventually receive ONE push,
    // never more.
    const store2 = new RideStore(makeRide());
    const push2 = new PushNotifier();
    runDispatchLoop(store2, ranked, { a: "decline", b: "decline", c: "accept" }, push2);
    expect(push2.pushesFor("b")).toHaveLength(1);
    expect(push2.pushesFor("c")).toHaveLength(1);
  });
});
