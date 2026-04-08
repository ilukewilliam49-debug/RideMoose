import { useEffect, useRef, useMemo } from "react";
import L from "leaflet";
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
  const { data: drivers } = useQuery({
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

  const driverCount = drivers?.length ?? 0;

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
      userMarkerRef.current = L.circleMarker([userLocation.lat, userLocation.lng], {
        radius: 8,
        fillColor: "hsl(var(--primary))",
        color: "#fff",
        weight: 3,
        opacity: 1,
        fillOpacity: 0.9,
      }).addTo(map).bindPopup("You");
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
