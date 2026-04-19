// Shared types and helpers for multi-stop rides.
//
// A ride has an implicit pickup (pickup_address/pickup_lat/pickup_lng) and
// dropoff. `stops` are intermediate waypoints between them, traversed in
// array order. Capped at 3 intermediate stops (5 total locations).

export const MAX_INTERMEDIATE_STOPS = 3;

export interface RideStop {
  address: string;
  lat: number;
  lng: number;
  notes?: string;
}

/** Per-stop courier surcharge (matches driver-side assumptions). */
export const PER_STOP_FEE_CENTS = 200; // $2.00

/** Haversine distance in km between two coordinates. */
export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * Total route distance through pickup → stops → dropoff using straight-line
 * (Haversine) distance. Used as a fallback when Google Directions is not
 * yet loaded.
 */
export function routeDistanceKm(
  pickup: { lat: number; lng: number } | null,
  stops: RideStop[],
  dropoff: { lat: number; lng: number } | null
): number | null {
  if (!pickup || !dropoff) return null;
  const points = [pickup, ...stops.map((s) => ({ lat: s.lat, lng: s.lng })), dropoff];
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += haversineKm(points[i], points[i + 1]);
  }
  return total;
}

/** URL serialisation for stops (compact JSON, encoded). */
export function encodeStopsParam(stops: RideStop[]): string | null {
  if (!stops.length) return null;
  return encodeURIComponent(JSON.stringify(stops));
}

export function decodeStopsParam(raw: string | null): RideStop[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(decodeURIComponent(raw));
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (s) =>
          s &&
          typeof s.address === "string" &&
          typeof s.lat === "number" &&
          typeof s.lng === "number"
      )
      .slice(0, MAX_INTERMEDIATE_STOPS);
  } catch {
    return [];
  }
}

/**
 * Coerce a value coming back from the database (jsonb) into a typed array.
 * Tolerates legacy rides that don't have the column populated.
 */
export function parseStopsFromDb(value: unknown): RideStop[] {
  if (!value) return [];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parseStopsFromDb(parsed);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (s: any) =>
        s &&
        typeof s.address === "string" &&
        typeof s.lat === "number" &&
        typeof s.lng === "number"
    )
    .map((s: any) => ({
      address: s.address,
      lat: s.lat,
      lng: s.lng,
      notes: typeof s.notes === "string" ? s.notes : undefined,
    }));
}
