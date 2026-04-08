import { useEffect, useRef, useMemo, useState } from "react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Car, Briefcase, Package } from "lucide-react";
import { useDriverETAs } from "@/hooks/useDriverETAs";

// Fix default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

// SVG paths for vehicle types
const vehicleSvgs: Record<string, string> = {
  sedan: `<path d="M5 17h1a2 2 0 0 0 4 0h4a2 2 0 0 0 4 0h1a1 1 0 0 0 1-1v-3a1 1 0 0 0-.4-.8l-2.6-2a1 1 0 0 0-.2-.1L15 9H9L6.2 10.1a1 1 0 0 0-.2.1l-2.6 2A1 1 0 0 0 3 13v3a1 1 0 0 0 1 1z" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8" cy="17" r="1.5" fill="white"/><circle cx="16" cy="17" r="1.5" fill="white"/>`,
  suv: `<rect x="3" y="10" width="18" height="7" rx="1" fill="none" stroke="white" stroke-width="1.5"/><path d="M5 10V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2" fill="none" stroke="white" stroke-width="1.5"/><circle cx="7.5" cy="17" r="2" fill="white"/><circle cx="16.5" cy="17" r="2" fill="white"/>`,
  van: `<rect x="2" y="8" width="14" height="9" rx="1" fill="none" stroke="white" stroke-width="1.5"/><path d="M16 8h3l3 4v5h-6V8z" fill="none" stroke="white" stroke-width="1.5"/><circle cx="7" cy="17" r="2" fill="white"/><circle cx="17" cy="17" r="2" fill="white"/>`,
};

const defaultVehicleSvg = vehicleSvgs.sedan;

function getVehicleIcon(vehicleType?: string | null): L.DivIcon {
  const type = (vehicleType || "").toLowerCase();
  const svg = vehicleSvgs[type] || defaultVehicleSvg;
  const label = type === "suv" ? "SUV" : type === "van" ? "Van" : "Sedan";

  return L.divIcon({
    className: "",
    iconSize: [36, 44],
    iconAnchor: [18, 44],
    popupAnchor: [0, -44],
    html: `<div style="display:flex;flex-direction:column;align-items:center">
      <div style="width:36px;height:36px;border-radius:50%;background:hsl(45,93%,47%);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.3);border:2px solid #fff">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">${svg}</svg>
      </div>
      <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid hsl(45,93%,47%);margin-top:-1px"></div>
    </div>`,
  });
}

type Tab = "taxi" | "charter" | "delivery";

interface MockDriver {
  id: string;
  full_name: string;
  latitude: number;
  longitude: number;
  can_taxi: boolean;
  can_private_hire: boolean;
  can_courier: boolean;
  vehicle_type: string;
}

const MOCK_DRIVERS: MockDriver[] = [
  { id: "mock-1", full_name: "Alex Taylor", latitude: 62.457, longitude: -114.375, can_taxi: true, can_private_hire: false, can_courier: false, vehicle_type: "sedan" },
  { id: "mock-2", full_name: "Jordan Lee", latitude: 62.461, longitude: -114.365, can_taxi: true, can_private_hire: true, can_courier: false, vehicle_type: "suv" },
  { id: "mock-3", full_name: "Morgan Chen", latitude: 62.450, longitude: -114.358, can_taxi: false, can_private_hire: true, can_courier: true, vehicle_type: "van" },
  { id: "mock-4", full_name: "Sam Rivera", latitude: 62.448, longitude: -114.380, can_taxi: false, can_private_hire: false, can_courier: true, vehicle_type: "sedan" },
];

interface NearbyDriversMapProps {
  activeTab: Tab;
  userLocation: { lat: number; lng: number } | null;
}

const VEHICLE_TYPES = ["sedan", "suv", "van"] as const;
type VehicleFilter = (typeof VEHICLE_TYPES)[number];

const vehicleFilterLabels: Record<VehicleFilter, string> = {
  sedan: "Sedan",
  suv: "SUV",
  van: "Van",
};

const NearbyDriversMap = ({ activeTab, userLocation }: NearbyDriversMapProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const [activeFilters, setActiveFilters] = useState<Set<VehicleFilter>>(
    new Set(VEHICLE_TYPES)
  );

  const toggleFilter = (type: VehicleFilter) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        if (next.size > 1) next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

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
  const allDrivers = useMemo(() => {
    if (dbDrivers && dbDrivers.length > 0) return dbDrivers;
    return MOCK_DRIVERS.filter((d) => {
      if (activeTab === "taxi") return d.can_taxi;
      if (activeTab === "charter") return d.can_private_hire;
      return d.can_courier;
    });
  }, [dbDrivers, activeTab]);

  // Apply vehicle type filter
  const drivers = useMemo(() => {
    return allDrivers.filter((d) => {
      const vt = ("vehicle_type" in d ? (d as any).vehicle_type : "sedan") || "sedan";
      return activeFilters.has(vt.toLowerCase() as VehicleFilter);
    });
  }, [allDrivers, activeFilters]);

  // Fetch live traffic-based ETAs for filtered drivers
  const driverCoords = useMemo(
    () =>
      drivers
        .filter((d) => d.latitude && d.longitude)
        .map((d) => ({ id: d.id, latitude: d.latitude!, longitude: d.longitude! })),
    [drivers]
  );
  const etas = useDriverETAs(driverCoords, userLocation);

  // Count per vehicle type for filter badges
  const vehicleCounts = useMemo(() => {
    const counts: Record<VehicleFilter, number> = { sedan: 0, suv: 0, van: 0 };
    allDrivers.forEach((d) => {
      const vt = (("vehicle_type" in d ? (d as any).vehicle_type : "sedan") || "sedan").toLowerCase() as VehicleFilter;
      if (vt in counts) counts[vt]++;
      else counts.sedan++;
    });
    return counts;
  }, [allDrivers]);

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
      const vType = "vehicle_type" in d ? (d as any).vehicle_type : undefined;
      const icon = getVehicleIcon(vType);
      const label = (vType || "").toLowerCase();
      const vehicleLabel = label === "suv" ? "SUV" : label === "van" ? "Van" : "Sedan";
      const eta = etas[d.id];
      const etaStr = eta ? eta.duration_text : "";
      const trafficIcon = eta?.traffic ? "🚦" : "🕐";
      const popupHtml = `<div style="text-align:center;font-family:system-ui,sans-serif;line-height:1.4">
        <div style="font-weight:600;font-size:13px">${d.full_name || "Driver"}</div>
        <div style="font-size:11px;color:#666">${vehicleLabel}</div>
        ${etaStr ? `<div style="margin-top:4px;font-size:12px;font-weight:700;color:hsl(142,71%,45%)">${trafficIcon} ${etaStr} away</div>` : ""}
      </div>`;
      const marker = L.marker([d.latitude, d.longitude], { icon })
        .addTo(map)
        .bindPopup(popupHtml);
      markersRef.current.push(marker);
    });
      const marker = L.marker([d.latitude, d.longitude], { icon })
        .addTo(map)
        .bindPopup(popupHtml);
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
  }, [drivers, userLocation, etas]);

  const tabLabel = activeTab === "taxi" ? "taxis" : activeTab === "charter" ? "PickYou drivers" : "couriers";
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
          {drivers.length} {tabLabel} nearby
        </span>
      </div>
      {/* Vehicle type filter legend */}
      <div className="absolute bottom-3 right-3 z-[1000] flex items-center gap-1.5">
        {VEHICLE_TYPES.map((type) => {
          const isActive = activeFilters.has(type);
          const count = vehicleCounts[type];
          return (
            <button
              key={type}
              onClick={() => toggleFilter(type)}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold border transition-all ${
                isActive
                  ? "bg-primary/90 text-primary-foreground border-primary shadow-sm"
                  : "bg-card/80 text-muted-foreground border-border/40 opacity-60"
              } backdrop-blur-sm`}
            >
              <span
                className="inline-block w-3 h-3 rounded-full"
                style={{ background: isActive ? "hsl(45,93%,47%)" : "hsl(var(--muted))" }}
                dangerouslySetInnerHTML={{
                  __html: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24">${vehicleSvgs[type]}</svg>`,
                }}
              />
              {vehicleFilterLabels[type]}
              <span className={`ml-0.5 ${isActive ? "text-primary-foreground/70" : "text-muted-foreground/60"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default NearbyDriversMap;
