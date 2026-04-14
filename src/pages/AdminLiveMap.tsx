import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AdminBreadcrumb from "@/components/admin/AdminBreadcrumb";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import ErrorRetry from "@/components/driver/ErrorRetry";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Radio, Car, MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";

// Fix default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;

const driverIcon = new L.DivIcon({
  html: `<div style="width:14px;height:14px;border-radius:50%;background:hsl(45,93%,47%);border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>`,
  className: "",
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

const pickupIcon = new L.DivIcon({
  html: `<div style="width:12px;height:12px;border-radius:50%;background:hsl(142,71%,45%);border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>`,
  className: "",
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

const dropoffIcon = new L.DivIcon({
  html: `<div style="width:12px;height:12px;border-radius:50%;background:hsl(0,84%,60%);border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>`,
  className: "",
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

const statusLabel: Record<string, string> = {
  requested: "Waiting",
  dispatched: "Dispatched",
  accepted: "Accepted",
  arrived: "Arrived",
  in_progress: "In progress",
};

export default function AdminLiveMap() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const driverLayerRef = useRef<L.LayerGroup | null>(null);
  const rideLayerRef = useRef<L.LayerGroup | null>(null);

  // Online drivers
  const { data: drivers, isLoading: driversLoading, isError: driversError, refetch: refetchDrivers } = useQuery({
    queryKey: ["admin-live-drivers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, latitude, longitude, vehicle_type, vehicle_make, vehicle_model, license_plate, is_available")
        .eq("role", "driver")
        .eq("is_available", true)
        .not("latitude", "is", null)
        .not("longitude", "is", null);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 10000,
  });

  // Active rides
  const { data: rides, isLoading: ridesLoading } = useQuery({
    queryKey: ["admin-live-rides"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rides")
        .select("id, status, service_type, pickup_address, dropoff_address, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, rider:rider_id(full_name), driver:driver_id(full_name)")
        .in("status", ["requested", "dispatched", "accepted", "arrived", "in_progress"]);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 10000,
  });

  // Realtime invalidation
  useEffect(() => {
    const channel = supabase
      .channel("admin-live-map")
      .on("postgres_changes", { event: "*", schema: "public", table: "rides" }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin-live-rides"] });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin-live-drivers"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  // Init map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    mapRef.current = L.map(containerRef.current, {
      center: [64.135, -21.895], // Reykjavik default
      zoom: 12,
      attributionControl: false,
    });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; OpenStreetMap',
    }).addTo(mapRef.current);

    driverLayerRef.current = L.layerGroup().addTo(mapRef.current);
    rideLayerRef.current = L.layerGroup().addTo(mapRef.current);

    return () => { mapRef.current?.remove(); mapRef.current = null; };
  }, []);

  // Update driver markers
  useEffect(() => {
    const layer = driverLayerRef.current;
    if (!layer) return;
    layer.clearLayers();

    (drivers || []).forEach((d: any) => {
      if (d.latitude && d.longitude) {
        const vehicle = [d.vehicle_make, d.vehicle_model, d.license_plate].filter(Boolean).join(" ");
        const marker = L.marker([d.latitude, d.longitude], { icon: driverIcon })
          .bindPopup(`<b>${d.full_name || "Driver"}</b><br/>${vehicle || "No vehicle"}<br/><span style="color:green">● Online</span><br/><a href="#" class="live-map-link" data-driver="${d.id}" style="color:hsl(221,83%,53%);font-size:12px;font-weight:600;">View profile →</a>`)
          .addTo(layer);
        marker.on("popupopen", () => {
          setTimeout(() => {
            const el = document.querySelector(`a[data-driver="${d.id}"]`);
            if (el) el.addEventListener("click", (e) => { e.preventDefault(); navigate(`/admin/users/${d.id}`); });
          }, 0);
        });
      }
    });
  }, [drivers]);

  // Update ride markers
  useEffect(() => {
    const layer = rideLayerRef.current;
    if (!layer) return;
    layer.clearLayers();

    (rides || []).forEach((r: any) => {
      if (r.pickup_lat && r.pickup_lng) {
        const marker = L.marker([r.pickup_lat, r.pickup_lng], { icon: pickupIcon })
          .bindPopup(`<b>Pickup</b> — ${statusLabel[r.status] || r.status}<br/>${r.pickup_address}<br/>Rider: ${r.rider?.full_name || "—"}<br/>Driver: ${r.driver?.full_name || "Unassigned"}<br/><a href="#" class="live-map-link" data-ride="${r.id}" style="color:hsl(221,83%,53%);font-size:12px;font-weight:600;">View ride →</a>`)
          .addTo(layer);
        marker.on("popupopen", () => {
          setTimeout(() => {
            const el = document.querySelector(`a[data-ride="${r.id}"]`);
            if (el) el.addEventListener("click", (e) => { e.preventDefault(); navigate(`/admin/rides/${r.id}`); });
          }, 0);
        });
      }
      if (r.dropoff_lat && r.dropoff_lng && r.status === "in_progress") {
        L.marker([r.dropoff_lat, r.dropoff_lng], { icon: dropoffIcon })
          .bindPopup(`<b>Dropoff</b><br/>${r.dropoff_address}<br/><a href="#" class="live-map-link" data-ride-drop="${r.id}" style="color:hsl(221,83%,53%);font-size:12px;font-weight:600;">View ride →</a>`)
          .addTo(layer);
        // Attach click handler for dropoff popup too
        layer.eachLayer((l: any) => {
          if (l._popup?.getContent()?.includes(`data-ride-drop="${r.id}"`)) {
            l.on("popupopen", () => {
              setTimeout(() => {
                const el = document.querySelector(`a[data-ride-drop="${r.id}"]`);
                if (el) el.addEventListener("click", (e) => { e.preventDefault(); navigate(`/admin/rides/${r.id}`); });
              }, 0);
            });
          }
        });
      }
    });
  }, [rides]);

  // Fit bounds when data arrives
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const points: L.LatLngExpression[] = [];
    (drivers || []).forEach((d: any) => {
      if (d.latitude && d.longitude) points.push([d.latitude, d.longitude]);
    });
    (rides || []).forEach((r: any) => {
      if (r.pickup_lat && r.pickup_lng) points.push([r.pickup_lat, r.pickup_lng]);
    });
    if (points.length > 1) {
      map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 14 });
    } else if (points.length === 1) {
      map.setView(points[0], 14);
    }
  }, [drivers, rides]);

  const isLoading = driversLoading || ridesLoading;
  const driverCount = drivers?.length || 0;
  const rideCount = rides?.length || 0;

  return (
    <div className="space-y-4 pt-4">
      <AdminBreadcrumb pageTitle="Live Map" />
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Live Operations Map</h1>
          <p className="text-sm text-muted-foreground">Real-time view of online drivers and active rides</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="gap-1.5 py-1">
            <div className="h-2.5 w-2.5 rounded-full" style={{ background: "hsl(45,93%,47%)" }} />
            {driverCount} driver{driverCount !== 1 ? "s" : ""} online
          </Badge>
          <Badge variant="outline" className="gap-1.5 py-1">
            <div className="h-2.5 w-2.5 rounded-full" style={{ background: "hsl(142,71%,45%)" }} />
            {rideCount} active ride{rideCount !== 1 ? "s" : ""}
          </Badge>
        </div>
      </div>

      {driversError ? (
        <ErrorRetry message="Failed to load map data" onRetry={() => refetchDrivers()} />
      ) : (
        <div className="relative rounded-xl border border-border overflow-hidden">
          {isLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                Loading map data...
              </div>
            </div>
          )}
          <div ref={containerRef} style={{ height: "calc(100vh - 220px)", minHeight: 400 }} />
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-6 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-full" style={{ background: "hsl(45,93%,47%)" }} /> Online driver
        </span>
        <span className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-full" style={{ background: "hsl(142,71%,45%)" }} /> Pickup point
        </span>
        <span className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-full" style={{ background: "hsl(0,84%,60%)" }} /> Dropoff (in-progress)
        </span>
      </div>
    </div>
  );
}
