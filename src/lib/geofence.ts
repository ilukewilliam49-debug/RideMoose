/**
 * Point-in-polygon detection using ray casting algorithm.
 * Polygon is an array of [lat, lng] coordinate pairs.
 */
export function pointInPolygon(
  lat: number,
  lng: number,
  polygon: [number, number][]
): boolean {
  if (!polygon || polygon.length < 3) return false;

  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [yi, xi] = polygon[i];
    const [yj, xj] = polygon[j];

    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Given a coordinate and a list of geo zones, find the matching zone key.
 * Returns the zone_key string or null if no zone matches.
 */
export function detectGeoZone(
  lat: number,
  lng: number,
  geoZones: { zone_key: string; polygon: [number, number][] }[]
): string | null {
  for (const zone of geoZones) {
    if (pointInPolygon(lat, lng, zone.polygon)) {
      return zone.zone_key;
    }
  }
  return null;
}
