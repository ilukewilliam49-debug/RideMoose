import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import AdminBreadcrumb from "@/components/admin/AdminBreadcrumb";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import ZoneMap from "@/components/admin/ZoneMap";
import ZoneListPanel from "@/components/admin/ZoneListPanel";

interface GeoZone {
  id: string;
  zone_key: string;
  zone_name: string;
  polygon: [number, number][];
  color: string;
  created_at: string;
}

const AdminZones = () => {
  const queryClient = useQueryClient();
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [pendingPolygon, setPendingPolygon] = useState<[number, number][] | null>(null);

  // Confirmation dialog
  const [confirmAction, setConfirmAction] = useState<{
    title: string; description: string; onConfirm: () => void;
  } | null>(null);

  const { data: geoZones, isLoading: geoLoading } = useQuery({
    queryKey: ["admin-geo-zones"],
    queryFn: async () => {
      const { data, error } = await supabase.from("geo_zones").select("*").order("zone_key");
      if (error) throw error;
      return data.map((d) => ({ ...d, polygon: d.polygon as unknown as [number, number][] })) as GeoZone[];
    },
  });

  // ── Geo zone mutations ──
  const updateGeoMutation = useMutation({
    mutationFn: async ({ id, zone_key, zone_name, polygon, color }: { id: string; zone_key: string; zone_name: string; polygon: [number, number][]; color: string }) => {
      const { error } = await supabase.from("geo_zones").update({ zone_key, zone_name, polygon: polygon as any, color }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-geo-zones"] }); toast.success("Zone updated"); },
    onError: (err: any) => toast.error(err.message),
  });

  const createGeoMutation = useMutation({
    mutationFn: async (zone: { zone_key: string; zone_name: string; polygon: [number, number][]; color: string }) => {
      const { error } = await supabase.from("geo_zones").insert({ ...zone, polygon: zone.polygon as any });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-geo-zones"] });
      toast.success("Geofence created");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteGeoMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("geo_zones").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-geo-zones"] }); toast.success("Zone deleted"); },
    onError: (err: any) => toast.error(err.message),
  });

  const confirmDelete = (name: string, onConfirm: () => void) => {
    setConfirmAction({ title: `Delete "${name}"?`, description: "This action cannot be undone.", onConfirm });
  };

  const handlePolygonCreated = useCallback((coords: [number, number][]) => {
    setPendingPolygon(coords);
  }, []);

  const handlePolygonEdited = useCallback((id: string, coords: [number, number][]) => {
    const zone = geoZones?.find((z) => z.id === id);
    if (!zone) return;
    updateGeoMutation.mutate({ id, zone_key: zone.zone_key, zone_name: zone.zone_name, polygon: coords, color: zone.color });
  }, [geoZones, updateGeoMutation]);

  if (geoLoading) return <div className="py-8 text-center text-muted-foreground">Loading zones…</div>;

  return (
    <div className="space-y-4 pt-4">
      {/* Confirmation dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={(open) => { if (!open) setConfirmAction(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmAction?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmAction?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { confirmAction?.onConfirm(); setConfirmAction(null); }}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AdminBreadcrumb pageTitle="Geofence Zones" />
      <h1 className="text-2xl font-bold">Geofence Zones</h1>

      <div className="flex flex-col lg:flex-row gap-0 border rounded-lg overflow-hidden" style={{ height: "70vh" }}>
        {/* Left panel: zone list */}
        <div className="w-full lg:w-72 shrink-0 border-b lg:border-b-0 lg:border-r bg-background overflow-hidden" style={{ maxHeight: "70vh" }}>
          <ZoneListPanel
            geoZones={geoZones || []}
            selectedZoneId={selectedZoneId}
            onSelectZone={setSelectedZoneId}
            onSave={(id, data) => updateGeoMutation.mutate({ id, ...data })}
            onDelete={(id, name) => confirmDelete(name, () => deleteGeoMutation.mutate(id))}
            onCreate={(data) => createGeoMutation.mutate(data)}
            pendingPolygon={pendingPolygon}
            onClearPendingPolygon={() => setPendingPolygon(null)}
          />
        </div>
        {/* Right panel: map */}
        <div className="flex-1 min-h-[300px]">
          <ZoneMap
            geoZones={geoZones || []}
            selectedZoneId={selectedZoneId}
            onSelectZone={setSelectedZoneId}
            onPolygonCreated={handlePolygonCreated}
            onPolygonEdited={handlePolygonEdited}
          />
        </div>
      </div>
    </div>
  );
};

export default AdminZones;
