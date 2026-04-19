import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const pickupIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const dropoffIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const driverIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-gold.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export interface MapMarker {
  lat: number;
  lng: number;
  type: "pickup" | "dropoff" | "driver" | "stop";
  label?: string;
  /** 1-based index for "stop" markers (rendered inside the badge). */
  index?: number;
}

interface RideMapProps {
  markers: MapMarker[];
  center?: [number, number];
  className?: string;
  polyline?: string | null;
  routeInfo?: { distanceKm: number; durationText: string } | null;
}

/** Decode Google Maps encoded polyline string into [lat, lng] pairs */
const decodePolyline = (encoded: string): [number, number][] => {
  const points: [number, number][] = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let b, shift = 0, result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);
    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
};

const iconMap = { pickup: pickupIcon, dropoff: dropoffIcon, driver: driverIcon };

/** Build a stop-sign shaped marker for an intermediate stop. */
const stopBadgeIcon = (index: number) =>
  L.divIcon({
    html: `<div style="position:relative;width:30px;height:30px;filter:drop-shadow(0 2px 4px hsl(0 0% 0%/0.35));">
      <svg viewBox="0 0 100 100" width="30" height="30" xmlns="http://www.w3.org/2000/svg">
        <polygon
          points="30,5 70,5 95,30 95,70 70,95 30,95 5,70 5,30"
          fill="hsl(0 84% 50%)"
          stroke="#fff"
          stroke-width="6"
          stroke-linejoin="round"
        />
        <text
          x="50" y="58"
          text-anchor="middle"
          font-family="system-ui,-apple-system,sans-serif"
          font-size="32"
          font-weight="900"
          fill="#fff"
          letter-spacing="-1"
        >STOP</text>
      </svg>
      <div style="
        position:absolute;top:-4px;right:-4px;
        display:flex;align-items:center;justify-content:center;
        width:16px;height:16px;border-radius:9999px;
        background:hsl(var(--background));
        color:hsl(var(--foreground));
        border:1.5px solid hsl(0 84% 50%);
        font-size:9px;font-weight:800;font-family:system-ui,sans-serif;
        line-height:1;
      ">${index}</div>
    </div>`,
    className: "",
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });

const RideMap = ({ markers, center = [62.454, -114.372], className = "", polyline, routeInfo }: RideMapProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const driverMarkerRef = useRef<L.Marker | null>(null);
  const driverAnimRef = useRef<number | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const labelRef = useRef<L.Marker | null>(null);

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const mapCenter: L.LatLngExpression = markers.length > 0
      ? [markers[0].lat, markers[0].lng]
      : center;

    mapRef.current = L.map(containerRef.current, {
      center: mapCenter,
      zoom: 13,
      scrollWheelZoom: false,
      attributionControl: false,
    });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(mapRef.current);

    return () => {
      if (driverAnimRef.current != null) {
        cancelAnimationFrame(driverAnimRef.current);
        driverAnimRef.current = null;
      }
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Update markers (pickup, dropoff, stops) — driver handled separately for smooth animation
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old static markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const staticMarkers = markers.filter((m) => m.type !== "driver");
    staticMarkers.forEach((m) => {
      const icon = m.type === "stop" ? stopBadgeIcon(m.index ?? 1) : (iconMap as any)[m.type];
      const marker = L.marker([m.lat, m.lng], { icon }).addTo(map);
      if (m.label) marker.bindPopup(m.label);
      markersRef.current.push(marker);
    });

    // Fit bounds to ALL markers (including driver) on first add or when set changes
    if (markers.length === 1) {
      map.setView([markers[0].lat, markers[0].lng], 15);
    } else if (markers.length > 1) {
      const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lng] as L.LatLngExpression));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    }
  }, [markers]);

  // Smoothly animate driver marker between location updates
  const driver = markers.find((m) => m.type === "driver");
  const driverLat = driver?.lat;
  const driverLng = driver?.lng;
  const driverLabel = driver?.label;

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Driver gone — remove marker
    if (driverLat == null || driverLng == null) {
      if (driverAnimRef.current != null) {
        cancelAnimationFrame(driverAnimRef.current);
        driverAnimRef.current = null;
      }
      if (driverMarkerRef.current) {
        driverMarkerRef.current.remove();
        driverMarkerRef.current = null;
      }
      return;
    }

    // First time we see the driver — drop the marker in place
    if (!driverMarkerRef.current) {
      const marker = L.marker([driverLat, driverLng], { icon: driverIcon }).addTo(map);
      if (driverLabel) marker.bindPopup(driverLabel);
      driverMarkerRef.current = marker;
      return;
    }

    // Update popup if label changed
    if (driverLabel) {
      driverMarkerRef.current.bindPopup(driverLabel);
    }

    // Animate from current position to new position
    if (driverAnimRef.current != null) {
      cancelAnimationFrame(driverAnimRef.current);
      driverAnimRef.current = null;
    }

    const start = driverMarkerRef.current.getLatLng();
    const endLat = driverLat;
    const endLng = driverLng;

    // Skip animation for tiny movements (< ~1m) to avoid jitter
    const dLat = endLat - start.lat;
    const dLng = endLng - start.lng;
    if (Math.abs(dLat) < 1e-5 && Math.abs(dLng) < 1e-5) {
      driverMarkerRef.current.setLatLng([endLat, endLng]);
      return;
    }

    const duration = 1500; // ms — tween over 1.5s, well under the 10s polling cadence
    const startTime = performance.now();
    // ease-out cubic for a natural slow-to-stop
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);

    const step = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);
      const k = ease(t);
      const lat = start.lat + dLat * k;
      const lng = start.lng + dLng * k;
      driverMarkerRef.current?.setLatLng([lat, lng]);
      if (t < 1) {
        driverAnimRef.current = requestAnimationFrame(step);
      } else {
        driverAnimRef.current = null;
      }
    };
    driverAnimRef.current = requestAnimationFrame(step);
  }, [driverLat, driverLng, driverLabel]);


  // Draw route polyline with animation
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove previous polyline & label
    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }
    if (labelRef.current) {
      labelRef.current.remove();
      labelRef.current = null;
    }

    if (polyline) {
      const decoded = decodePolyline(polyline);

      // Create the full polyline (invisible initially) for bounds fitting
      const fullLine = L.polyline(decoded, {
        color: "hsl(var(--primary))",
        weight: 4,
        opacity: 0,
      }).addTo(map);

      // Fit bounds to include polyline
      map.fitBounds(fullLine.getBounds(), { padding: [40, 40], maxZoom: 16 });

      // Shadow/glow layer behind the route
      const shadowLine = L.polyline([], {
        color: "hsl(var(--primary))",
        weight: 12,
        opacity: 0.2,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(map);

      // Animate: progressively reveal segments
      const animatedLine = L.polyline([], {
        color: "hsl(var(--primary))",
        weight: 4,
        opacity: 0.85,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(map);

      polylineRef.current = animatedLine;

      const totalPoints = decoded.length;
      const duration = 800; // ms
      const stepTime = Math.max(5, duration / totalPoints);
      let currentIndex = 0;

      const interval = setInterval(() => {
        const batchSize = Math.max(1, Math.ceil(totalPoints / (duration / stepTime)));
        const end = Math.min(currentIndex + batchSize, totalPoints);
        for (let i = currentIndex; i < end; i++) {
          shadowLine.addLatLng(decoded[i]);
          animatedLine.addLatLng(decoded[i]);
        }
        currentIndex = end;
        if (currentIndex >= totalPoints) {
          clearInterval(interval);
          fullLine.remove();

          // Add route info label at midpoint
          if (routeInfo && decoded.length > 2) {
            const midIdx = Math.floor(decoded.length / 2);
            const midPoint = decoded[midIdx];
            const distLabel = routeInfo.distanceKm < 1
              ? `${Math.round(routeInfo.distanceKm * 1000)} m`
              : `${routeInfo.distanceKm.toFixed(1)} km`;
            const html = `<div style="
              display:flex;align-items:center;gap:6px;
              background:hsl(var(--card));
              color:hsl(var(--card-foreground));
              border:1px solid hsl(var(--border));
              border-radius:9999px;
              padding:4px 10px;
              font-size:11px;font-weight:700;
              white-space:nowrap;
              box-shadow:0 2px 8px hsl(0 0% 0%/0.15);
              pointer-events:none;
            ">
              <span>${distLabel}</span>
              <span style="color:hsl(var(--muted-foreground))">·</span>
              <span>${routeInfo.durationText}</span>
            </div>`;
            labelRef.current = L.marker(midPoint as L.LatLngExpression, {
              icon: L.divIcon({
                html,
                className: "",
                iconSize: [0, 0],
                iconAnchor: [0, 12],
              }),
              interactive: false,
            }).addTo(map);
          }
        }
      }, stepTime);

      return () => {
        clearInterval(interval);
        fullLine.remove();
        shadowLine.remove();
        if (labelRef.current) {
          labelRef.current.remove();
          labelRef.current = null;
        }
      };
    }
  }, [polyline, routeInfo]);

  return (
    <div
      ref={containerRef}
      className={`rounded-lg overflow-hidden border border-border relative z-0 ${className}`}
      style={{ height: 300 }}
    />
  );
};

export default RideMap;
