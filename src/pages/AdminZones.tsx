import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Save, Plus, Trash2, MapPinned } from "lucide-react";
import AdminBreadcrumb from "@/components/admin/AdminBreadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import ZoneMap from "@/components/admin/ZoneMap";
import ZoneListPanel from "@/components/admin/ZoneListPanel";

interface Zone {
  id: string;
  zone_name: string;
  pickup_zone: string;
  dropoff_zone: string;
  flat_fare_cents: number;
  active: boolean;
  created_at: string;
}

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

  // Route pricing state
  const [editState, setEditState] = useState<Record<string, Partial<Zone>>>({});
  const [newRoute, setNewRoute] = useState({ zone_name: "", pickup_zone: "", dropoff_zone: "", flat_fare_cents: 5000 });

  // Confirmation dialog
  const [confirmAction, setConfirmAction] = useState<{
    title: string; description: string; onConfirm: () => void;
  } | null>(null);

  // ── Queries ──
  const { data: zones, isLoading } = useQuery({
    queryKey: ["admin-zones"],
    queryFn: async () => {
      const { data, error } = await supabase.from("private_hire_zones").select("*").order("zone_name");
      if (error) throw error;
      return data as Zone[];
    },
  });

  const { data: geoZones, isLoading: geoLoading } = useQuery({
    queryKey: ["admin-geo-zones"],
    queryFn: async () => {
      const { data, error } = await supabase.from("geo_zones").select("*").order("zone_key");
      if (error) throw error;
      return data.map((d) => ({ ...d, polygon: d.polygon as unknown as [number, number][] })) as GeoZone[];
    },
  });

  // ── Route pricing mutations ──
  const updateMutation = useMutation({
    mutationFn: async (zone: Zone) => {
      const { id, created_at, ...updates } = zone;
      const { error } = await supabase.from("private_hire_zones").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-zones"] }); toast.success("Route updated"); },
    onError: (err: any) => toast.error(err.message),
  });

  const createRouteMutation = useMutation({
    mutationFn: async (zone: typeof newRoute) => {
      const { error } = await supabase.from("private_hire_zones").insert(zone);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-zones"] });
      toast.success("Route created");
      setNewRoute({ zone_name: "", pickup_zone: "", dropoff_zone: "", flat_fare_cents: 5000 });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteRouteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("private_hire_zones").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-zones"] }); toast.success("Route deleted"); },
    onError: (err: any) => toast.error(err.message),
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

  // Route pricing helpers
  const handleChange = (id: string, field: keyof Zone, value: any) => {
    setEditState((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };
  const getEdited = (zone: Zone): Zone => ({ ...zone, ...(editState[zone.id] || {}) });
  const isDirty = (id: string) => !!editState[id] && Object.keys(editState[id]).length > 0;
  const handleSave = (zone: Zone) => {
    updateMutation.mutate(getEdited(zone));
    setEditState((prev) => { const next = { ...prev }; delete next[zone.id]; return next; });
  };

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

  if (isLoading || geoLoading) return <div className="py-8 text-center text-muted-foreground">Loading zones…</div>;

  const geoZoneKeys = geoZones?.map((z) => ({ key: z.zone_key, name: z.zone_name })) || [];

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

      <AdminBreadcrumb pageTitle="Private Hire Zones" />
      <h1 className="text-2xl font-bold">Private Hire Zones</h1>

      <Tabs defaultValue="geofences" className="w-full">
        <TabsList>
          <TabsTrigger value="geofences">Geofence Boundaries</TabsTrigger>
          <TabsTrigger value="pricing">Route Pricing</TabsTrigger>
        </TabsList>

        {/* ── Geofence Boundaries Tab ── */}
        <TabsContent value="geofences" className="mt-4">
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
              />
            </div>
          </div>
        </TabsContent>

        {/* ── Route Pricing Tab ── */}
        <TabsContent value="pricing" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Plus className="h-5 w-5 text-primary" /> Add Route
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Route Name</Label>
                  <Input value={newRoute.zone_name} onChange={(e) => setNewRoute({ ...newRoute, zone_name: e.target.value })} placeholder="e.g. Airport Transfer" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Pickup Zone</Label>
                  <Select value={newRoute.pickup_zone} onValueChange={(v) => setNewRoute({ ...newRoute, pickup_zone: v })}>
                    <SelectTrigger className="h-10"><SelectValue placeholder="Select zone" /></SelectTrigger>
                    <SelectContent>
                      {geoZoneKeys.map((z) => (
                        <SelectItem key={z.key} value={z.key}>{z.name} ({z.key})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Dropoff Zone</Label>
                  <Select value={newRoute.dropoff_zone} onValueChange={(v) => setNewRoute({ ...newRoute, dropoff_zone: v })}>
                    <SelectTrigger className="h-10"><SelectValue placeholder="Select zone" /></SelectTrigger>
                    <SelectContent>
                      {geoZoneKeys.map((z) => (
                        <SelectItem key={z.key} value={z.key}>{z.name} ({z.key})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Flat Fare ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={(newRoute.flat_fare_cents / 100).toFixed(2)}
                    onChange={(e) => setNewRoute({ ...newRoute, flat_fare_cents: Math.round(parseFloat(e.target.value || "0") * 100) })}
                  />
                </div>
              </div>
              <Button size="sm" onClick={() => createRouteMutation.mutate(newRoute)} disabled={!newRoute.zone_name || !newRoute.pickup_zone || !newRoute.dropoff_zone || createRouteMutation.isPending}>
                <Plus className="h-4 w-4 mr-1" /> Create Route
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Route</TableHead>
                    <TableHead>Pickup Zone</TableHead>
                    <TableHead>Dropoff Zone</TableHead>
                    <TableHead className="text-right">Fare</TableHead>
                    <TableHead className="w-16">Active</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {zones?.map((zone) => {
                    const edited = getEdited(zone);
                    const pickupLabel = geoZones?.find((g) => g.zone_key === edited.pickup_zone)?.zone_name;
                    const dropoffLabel = geoZones?.find((g) => g.zone_key === edited.dropoff_zone)?.zone_name;
                    return (
                      <TableRow key={zone.id}>
                        <TableCell>
                          <Input
                            value={edited.zone_name}
                            onChange={(e) => handleChange(zone.id, "zone_name", e.target.value)}
                            className="h-8 text-sm border-transparent hover:border-input focus:border-input"
                          />
                        </TableCell>
                        <TableCell>
                          <Select value={edited.pickup_zone} onValueChange={(v) => handleChange(zone.id, "pickup_zone", v)}>
                            <SelectTrigger className="h-8 text-xs border-transparent hover:border-input">
                              <SelectValue>{pickupLabel || edited.pickup_zone}</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {geoZoneKeys.map((z) => (
                                <SelectItem key={z.key} value={z.key}>{z.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select value={edited.dropoff_zone} onValueChange={(v) => handleChange(zone.id, "dropoff_zone", v)}>
                            <SelectTrigger className="h-8 text-xs border-transparent hover:border-input">
                              <SelectValue>{dropoffLabel || edited.dropoff_zone}</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {geoZoneKeys.map((z) => (
                                <SelectItem key={z.key} value={z.key}>{z.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          <Input
                            type="number"
                            step="0.01"
                            value={(edited.flat_fare_cents / 100).toFixed(2)}
                            onChange={(e) => handleChange(zone.id, "flat_fare_cents", Math.round(parseFloat(e.target.value || "0") * 100))}
                            className="h-8 w-24 text-right text-sm ml-auto border-transparent hover:border-input focus:border-input"
                          />
                        </TableCell>
                        <TableCell>
                          <Switch checked={edited.active} onCheckedChange={(v) => handleChange(zone.id, "active", v)} />
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-0.5">
                            <Button size="icon" variant="ghost" className="h-7 w-7" disabled={!isDirty(zone.id)} onClick={() => handleSave(zone)}>
                              <Save className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => confirmDelete(edited.zone_name, () => deleteRouteMutation.mutate(zone.id))}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {(!zones || zones.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No routes configured yet. Add one above.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminZones;
