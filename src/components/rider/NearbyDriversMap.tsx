import { useEffect, useRef, useMemo } from "react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Car, Briefcase, Package } from "lucide-react";

// Fix default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const driverIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-gold.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

type Tab = "taxi" | "charter" | "delivery";

interface MockDriver {
  id: string;
  full_name: string;
  latitude: number;
  longitude: number;
  can_taxi: boolean;
  can_private_hire: boolean;
  can_courier: boolean;
}

const MOCK_DRIVERS: MockDriver[] = [
  { id: "mock-1", full_name: "Alex Taylor", latitude: 62.457, longitude: -114.375, can_taxi: true, can_private_hire: false, can_courier: false },
  { id: "mock-2", full_name: "Jordan Lee", latitude: 62.461, longitude: -114.365, can_taxi: true, can_private_hire: true, can_courier: false },
  { id: "mock-3", full_name: "Morgan Chen", latitude: 62.450, longitude: -114.358, can_taxi: false, can_private_hire: true, can_courier: true },
  { id: "mock-4", full_name: "Sam Rivera", latitude: 62.448, longitude: -114.380, can_taxi: false, can_private_hire: false, can_courier: true },
];

interface NearbyDriversMapProps {
  activeTab: Tab;
  userLocation: { lat: number; lng: number } | null;
}

const NearbyDriversMap = ({ activeTab, userLocation }: NearbyDriversMapProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const userMarkerRef = useRef<L.CircleMarker | null>(null);

  // Query available drivers
  const { data: dbDrivers } = useQuery({
    queryKey: ["nearby-drivers", activeTab],
    queryFn: async () => {
      let query = supabase
        .from("profiles")
        .select("id, full_name, latitude, longitude, can_taxi, can_private_hire, can_courier, can_shuttle, vehicle_type")
        .eq("role", "driver")
        .eq("is_available", true)
        .not("latitude", "is", null)
        .not("longitude", "is", null);

      if (activeTab === "taxi") {
        query = query.eq("can_taxi", true);
      } else if (activeTab === "charter") {
        query = query.eq("can_private_hire", true);
      } else {
        query = query.eq("can_courier", true);
      }

      const { data, error } = await query.limit(50);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 15000,
  });

  // Use DB drivers if available, otherwise fall back to filtered mock data
  const drivers = useMemo(() => {
    if (dbDrivers && dbDrivers.length > 0) return dbDrivers;
    return MOCK_DRIVERS.filter((d) => {
      if (activeTab === "taxi") return d.can_taxi;
      if (activeTab === "charter") return d.can_private_hire;
      return d.can_courier;
    });
  }, [dbDrivers, activeTab]);

  const driverCount = drivers.length;

  const center: [number, number] = userLocation
    ? [userLocation.lat, userLocation.lng]
    : [62.454, -114.372];

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    mapRef.current = L.map(containerRef.current, {
      center,
      zoom: 13,
      scrollWheelZoom: false,
      attributionControl: false,
      zoomControl: false,
    });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(mapRef.current);

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Update user location marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userLocation) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng([userLocation.lat, userLocation.lng]);
    } else {
      // Pulsing ring behind the dot
      const pulseIcon = L.divIcon({
        className: "",
        iconSize: [40, 40],
        iconAnchor: [20, 20],
        html: `<div style="position:relative;width:40px;height:40px">
          <div style="position:absolute;inset:0;border-radius:50%;background:hsl(var(--primary));opacity:0.25;animation:ld-pulse 2s cubic-bezier(0.4,0,0.6,1) infinite"></div>
          <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:16px;height:16px;border-radius:50%;background:hsl(var(--primary));border:3px solid #fff;box-shadow:0 0 6px rgba(0,0,0,0.3)"></div>
        </div>`,
      });
      userMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], {
        icon: pulseIcon,
        interactive: false,
        zIndexOffset: 1000,
      }).addTo(map);

      // Inject keyframes once
      if (!document.getElementById("ld-pulse-style")) {
        const style = document.createElement("style");
        style.id = "ld-pulse-style";
        style.textContent = `@keyframes ld-pulse{0%,100%{transform:scale(1);opacity:0.25}50%{transform:scale(1.6);opacity:0}}`;
        document.head.appendChild(style);
      }
    }

    map.setView([userLocation.lat, userLocation.lng], 13);
  }, [userLocation]);

  // Update driver markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old driver markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    if (!drivers || drivers.length === 0) return;

    drivers.forEach((d) => {
      if (!d.latitude || !d.longitude) return;
      const marker = L.marker([d.latitude, d.longitude], { icon: driverIcon })
        .addTo(map)
        .bindPopup(d.full_name || "Driver");
      markersRef.current.push(marker);
    });

    // Fit bounds to include all drivers + user
    const allPoints: L.LatLngExpression[] = drivers
      .filter((d) => d.latitude && d.longitude)
      .map((d) => [d.latitude!, d.longitude!] as L.LatLngExpression);

    if (userLocation) {
      allPoints.push([userLocation.lat, userLocation.lng]);
    }

    if (allPoints.length > 1) {
      map.fitBounds(L.latLngBounds(allPoints), { padding: [30, 30], maxZoom: 14 });
    }
  }, [drivers, userLocation]);

  const tabLabel = activeTab === "taxi" ? "taxis" : activeTab === "charter" ? "private cars" : "couriers";
  const TabIcon = activeTab === "taxi" ? Car : activeTab === "charter" ? Briefcase : Package;

  return (
    <div className="relative mt-4">
      <div
        ref={containerRef}
        className="rounded-2xl overflow-hidden border border-border/30"
        style={{ height: 200 }}
      />
      {/* Driver count badge */}
      <div className="absolute top-3 left-3 z-[1000] flex items-center gap-1.5 rounded-full bg-card/90 backdrop-blur-sm px-3 py-1.5 shadow-sm border border-border/30">
        <TabIcon className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-bold">
          {driverCount} {tabLabel} nearby
        </span>
      </div>
    </div>
  );
};

export default NearbyDriversMap;
