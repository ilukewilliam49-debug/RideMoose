import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/**
 * Full-bleed interactive map of Yellowknife for the landing hero.
 * Uses Carto Voyager tiles (matching the rest of the app) with a
 * branded pulsing pin on downtown YK.
 */
const YellowknifeMap = ({ className = "" }: { className?: string }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [62.454, -114.372], // Downtown Yellowknife
      zoom: 13,
      zoomControl: false,
      scrollWheelZoom: false,
      doubleClickZoom: true,
      dragging: true,
      touchZoom: true,
      keyboard: false,
      attributionControl: false,
    });

    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
      { attribution: "" },
    ).addTo(map);

    const pinHtml = `
      <div style="position:relative;width:36px;height:36px;display:flex;align-items:center;justify-content:center;">
        <div style="position:absolute;width:36px;height:36px;border-radius:9999px;background:hsl(var(--primary)/0.25);animation:pickyou-pin-pulse 2s ease-out infinite;"></div>
        <div style="position:relative;width:14px;height:14px;border-radius:9999px;background:hsl(var(--primary));box-shadow:0 0 0 3px hsl(var(--background)),0 4px 12px hsl(0 0% 0%/0.25);"></div>
      </div>
      <style>
        @keyframes pickyou-pin-pulse {
          0%   { transform:scale(0.6); opacity:0.9; }
          100% { transform:scale(2.2); opacity:0;   }
        }
      </style>
    `;

    L.marker([62.454, -114.372], {
      icon: L.divIcon({
        html: pinHtml,
        className: "",
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      }),
      interactive: false,
    }).addTo(map);

    mapRef.current = map;

    const handleResize = () => map.invalidateSize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-label="Live map of Yellowknife, NWT"
      role="img"
      className={`relative z-0 ${className}`}
    />
  );
};

export default YellowknifeMap;
