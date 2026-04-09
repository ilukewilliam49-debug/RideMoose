import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface SimulatorMapProps {
  pickup: { lat: number; lng: number } | null;
  dropoff: { lat: number; lng: number } | null;
  driverPos: { lat: number; lng: number } | null;
  route: { lat: number; lng: number }[];
}

const SimulatorMap = ({ pickup, dropoff, driverPos, route }: SimulatorMapProps) => {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const driverMarkerRef = useRef<L.CircleMarker | null>(null);
  const routeLineRef = useRef<L.Polyline | null>(null);
  const pickupMarkerRef = useRef<L.CircleMarker | null>(null);
  const dropoffMarkerRef = useRef<L.CircleMarker | null>(null);

  // Init map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
    }).setView([64.14, -21.9], 12);

    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update pickup/dropoff markers and fit bounds
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old markers
    pickupMarkerRef.current?.remove();
    dropoffMarkerRef.current?.remove();

    if (pickup) {
      pickupMarkerRef.current = L.circleMarker([pickup.lat, pickup.lng], {
        radius: 8, fillColor: "#22c55e", fillOpacity: 1, color: "#fff", weight: 2,
      }).addTo(map).bindTooltip("Pickup", { permanent: false });
    }
    if (dropoff) {
      dropoffMarkerRef.current = L.circleMarker([dropoff.lat, dropoff.lng], {
        radius: 8, fillColor: "#ef4444", fillOpacity: 1, color: "#fff", weight: 2,
      }).addTo(map).bindTooltip("Dropoff", { permanent: false });
    }

    if (pickup && dropoff) {
      map.fitBounds(
        L.latLngBounds([pickup.lat, pickup.lng], [dropoff.lat, dropoff.lng]),
        { padding: [30, 30], maxZoom: 15 }
      );
    }
  }, [pickup, dropoff]);

  // Draw route line
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    routeLineRef.current?.remove();

    if (route.length > 1) {
      routeLineRef.current = L.polyline(
        route.map((p) => [p.lat, p.lng] as L.LatLngTuple),
        { color: "hsl(221, 83%, 53%)", weight: 3, opacity: 0.5, dashArray: "6 8" }
      ).addTo(map);
    }
  }, [route]);

  // Move driver marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !driverPos) return;

    if (!driverMarkerRef.current) {
      driverMarkerRef.current = L.circleMarker([driverPos.lat, driverPos.lng], {
        radius: 10, fillColor: "hsl(221, 83%, 53%)", fillOpacity: 1, color: "#fff", weight: 3,
      }).addTo(map).bindTooltip("Driver", { permanent: true, direction: "top", offset: [0, -12] });
    } else {
      driverMarkerRef.current.setLatLng([driverPos.lat, driverPos.lng]);
    }
  }, [driverPos]);

  return (
    <div
      ref={containerRef}
      className="w-full h-[280px] rounded-xl border border-border/50 overflow-hidden"
    />
  );
};

export default SimulatorMap;
