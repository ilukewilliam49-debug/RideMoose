import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Save, Plus, Trash2, MapPinned, Pencil } from "lucide-react";
import AdminBreadcrumb from "@/components/admin/AdminBreadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import ErrorRetry from "@/components/driver/ErrorRetry";

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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editState, setEditState] = useState<Record<string, Partial<Zone>>>({});
  const [newZone, setNewZone] = useState({ zone_name: "", pickup_zone: "", dropoff_zone: "", flat_fare_cents: 5000 });

  // Geo zone editing
  const [geoEditState, setGeoEditState] = useState<Record<string, Partial<GeoZone & { polygonText?: string }>>>({});
  const [newGeoZone, setNewGeoZone] = useState({ zone_key: "", zone_name: "", color: "#3b82f6", polygonText: "[[0, 0]]" });

  // Confirmation dialog
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    description: string;
    onConfirm: () => void;
  } | null>(null);

  // ── Pricing zones ──
  const { data: zones, isLoading } = useQuery({
    queryKey: ["admin-zones"],
    queryFn: async () => {
      const { data, error } = await supabase.from("private_hire_zones").select("*").order("zone_name");
      if (error) throw error;
      return data as Zone[];
    },
  });

  // ── Geo zones ──
  const { data: geoZones, isLoading: geoLoading } = useQuery({
    queryKey: ["admin-geo-zones"],
    queryFn: async () => {
      const { data, error } = await supabase.from("geo_zones").select("*").order("zone_key");
      if (error) throw error;
      return data.map((d) => ({ ...d, polygon: d.polygon as unknown as [number, number][] })) as GeoZone[];
    },
  });

  // ── Pricing zone mutations ──
  const updateMutation = useMutation({
    mutationFn: async (zone: Zone) => {
      const { id, created_at, ...updates } = zone;
      const { error } = await supabase.from("private_hire_zones").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-zones"] }); toast.success("Zone updated!"); },
    onError: (err: any) => toast.error(err.message),
  });

  const createMutation = useMutation({
    mutationFn: async (zone: typeof newZone) => {
      const { error } = await supabase.from("private_hire_zones").insert(zone);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-zones"] });
      toast.success("Zone created!");
      setNewZone({ zone_name: "", pickup_zone: "", dropoff_zone: "", flat_fare_cents: 5000 });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("private_hire_zones").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-zones"] }); toast.success("Zone deleted!"); },
    onError: (err: any) => toast.error(err.message),
  });

  // ── Geo zone mutations ──
  const updateGeoMutation = useMutation({
    mutationFn: async ({ id, zone_key, zone_name, polygon, color }: { id: string; zone_key: string; zone_name: string; polygon: [number, number][]; color: string }) => {
      const { error } = await supabase.from("geo_zones").update({ zone_key, zone_name, polygon: polygon as any, color }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-geo-zones"] }); toast.success("Geo zone updated!"); },
    onError: (err: any) => toast.error(err.message),
  });

  const createGeoMutation = useMutation({
    mutationFn: async (zone: { zone_key: string; zone_name: string; polygon: [number, number][]; color: string }) => {
      const { error } = await supabase.from("geo_zones").insert({ ...zone, polygon: zone.polygon as any });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-geo-zones"] });
      toast.success("Geo zone created!");
      setNewGeoZone({ zone_key: "", zone_name: "", color: "#3b82f6", polygonText: "[[0, 0]]" });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteGeoMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("geo_zones").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-geo-zones"] }); toast.success("Geo zone deleted!"); },
    onError: (err: any) => toast.error(err.message),
  });

  // Pricing zone helpers
  const handleChange = (id: string, field: keyof Zone, value: any) => {
    setEditState((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };
  const getEdited = (zone: Zone): Zone => ({ ...zone, ...(editState[zone.id] || {}) });
  const isDirty = (id: string) => !!editState[id] && Object.keys(editState[id]).length > 0;
  const handleSave = (zone: Zone) => {
    updateMutation.mutate(getEdited(zone));
    setEditState((prev) => { const next = { ...prev }; delete next[zone.id]; return next; });
  };

  // Geo zone helpers
  const handleGeoChange = (id: string, field: string, value: any) => {
    setGeoEditState((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };
  const getGeoEdited = (zone: GeoZone) => {
    const overrides = geoEditState[zone.id] || {};
    return { ...zone, ...overrides };
  };
  const isGeoDirty = (id: string) => !!geoEditState[id] && Object.keys(geoEditState[id]).length > 0;

  const handleGeoSave = (zone: GeoZone) => {
    const edited = getGeoEdited(zone);
    let polygon = edited.polygon;
    // If polygonText was edited, parse it
    if (geoEditState[zone.id]?.polygonText !== undefined) {
      try {
        polygon = JSON.parse(geoEditState[zone.id].polygonText!);
      } catch {
        toast.error("Invalid polygon JSON");
        return;
      }
    }
    updateGeoMutation.mutate({ id: zone.id, zone_key: edited.zone_key, zone_name: edited.zone_name, polygon, color: edited.color });
    setGeoEditState((prev) => { const next = { ...prev }; delete next[zone.id]; return next; });
  };

  const handleCreateGeo = () => {
    try {
      const polygon = JSON.parse(newGeoZone.polygonText) as [number, number][];
      if (!Array.isArray(polygon)) throw new Error();
      createGeoMutation.mutate({ zone_key: newGeoZone.zone_key, zone_name: newGeoZone.zone_name, polygon, color: newGeoZone.color });
    } catch {
      toast.error("Invalid polygon JSON. Use format: [[lat, lng], [lat, lng], ...]");
    }
  };

  if (isLoading || geoLoading) return <div className="py-8 text-center text-muted-foreground">Loading zones…</div>;

  const confirmDelete = (name: string, onConfirm: () => void) => {
    setConfirmAction({
      title: `Delete "${name}"?`,
      description: "This action cannot be undone. The zone will be permanently removed.",
      onConfirm,
    });
  };

  return (
    <div className="space-y-6 pt-4">
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

      <Tabs defaultValue="pricing" className="w-full">
        <TabsList>
          <TabsTrigger value="pricing">Route Pricing</TabsTrigger>
          <TabsTrigger value="geofences">Geofence Boundaries</TabsTrigger>
        </TabsList>

        {/* ── Route Pricing Tab ── */}
        <TabsContent value="pricing" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Plus className="h-5 w-5 text-primary" /> Add Route
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Route Name</Label>
                  <Input value={newZone.zone_name} onChange={(e) => setNewZone({ ...newZone, zone_name: e.target.value })} placeholder="e.g. Airport Transfer" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Fare (cents)</Label>
                  <Input type="number" value={newZone.flat_fare_cents} onChange={(e) => setNewZone({ ...newZone, flat_fare_cents: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Pickup Zone Key</Label>
                  <Input value={newZone.pickup_zone} onChange={(e) => setNewZone({ ...newZone, pickup_zone: e.target.value })} placeholder="e.g. city, airport" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Dropoff Zone Key</Label>
                  <Input value={newZone.dropoff_zone} onChange={(e) => setNewZone({ ...newZone, dropoff_zone: e.target.value })} placeholder="e.g. airport, ingraham_trail" />
                </div>
              </div>
              <Button size="sm" onClick={() => createMutation.mutate(newZone)} disabled={!newZone.zone_name || !newZone.pickup_zone || !newZone.dropoff_zone || createMutation.isPending}>
                <Plus className="h-4 w-4 mr-1" /> Create Route
              </Button>
            </CardContent>
          </Card>

          <div className="space-y-3">
            {zones?.map((zone) => {
              const edited = getEdited(zone);
              return (
                <motion.div key={zone.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                  <Card>
                    <CardContent className="p-4">
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Route Name</Label>
                          <Input value={edited.zone_name} onChange={(e) => handleChange(zone.id, "zone_name", e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Pickup Zone</Label>
                          <Input value={edited.pickup_zone} onChange={(e) => handleChange(zone.id, "pickup_zone", e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Dropoff Zone</Label>
                          <Input value={edited.dropoff_zone} onChange={(e) => handleChange(zone.id, "dropoff_zone", e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Fare (cents)</Label>
                          <Input type="number" value={edited.flat_fare_cents} onChange={(e) => handleChange(zone.id, "flat_fare_cents", parseInt(e.target.value) || 0)} />
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-2">
                            <Label className="text-xs">Active</Label>
                            <Switch checked={edited.active} onCheckedChange={(v) => handleChange(zone.id, "active", v)} />
                          </div>
                          <Button size="icon" variant="ghost" disabled={!isDirty(zone.id)} onClick={() => handleSave(zone)}>
                            <Save className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => confirmDelete(edited.zone_name, () => deleteMutation.mutate(zone.id))}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                        <MapPinned className="h-3 w-3" />
                        {edited.pickup_zone} → {edited.dropoff_zone} = ${(edited.flat_fare_cents / 100).toFixed(2)}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </TabsContent>

        {/* ── Geofence Boundaries Tab ── */}
        <TabsContent value="geofences" className="space-y-4 mt-4">
          <p className="text-sm text-muted-foreground">
            Define polygon boundaries for each zone. Coordinates are entered as JSON arrays of <code>[lat, lng]</code> pairs. When a rider selects pickup/dropoff locations, the system checks which polygon contains those coordinates.
          </p>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Plus className="h-5 w-5 text-primary" /> Add Geofence
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Zone Key</Label>
                  <Input value={newGeoZone.zone_key} onChange={(e) => setNewGeoZone({ ...newGeoZone, zone_key: e.target.value })} placeholder="e.g. airport" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Display Name</Label>
                  <Input value={newGeoZone.zone_name} onChange={(e) => setNewGeoZone({ ...newGeoZone, zone_name: e.target.value })} placeholder="e.g. Yellowknife Airport" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Color</Label>
                  <div className="flex gap-2">
                    <input type="color" value={newGeoZone.color} onChange={(e) => setNewGeoZone({ ...newGeoZone, color: e.target.value })} className="h-9 w-12 rounded border border-border cursor-pointer" />
                    <Input value={newGeoZone.color} onChange={(e) => setNewGeoZone({ ...newGeoZone, color: e.target.value })} className="flex-1" />
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Polygon Coordinates (JSON)</Label>
                <Textarea
                  rows={3}
                  value={newGeoZone.polygonText}
                  onChange={(e) => setNewGeoZone({ ...newGeoZone, polygonText: e.target.value })}
                  placeholder='[[62.46, -114.38], [62.46, -114.35], [62.44, -114.35], [62.44, -114.38]]'
                  className="font-mono text-xs"
                />
              </div>
              <Button size="sm" onClick={handleCreateGeo} disabled={!newGeoZone.zone_key || !newGeoZone.zone_name || createGeoMutation.isPending}>
                <Plus className="h-4 w-4 mr-1" /> Create Geofence
              </Button>
            </CardContent>
          </Card>

          <div className="space-y-3">
            {geoZones?.map((zone) => {
              const edited = getGeoEdited(zone);
              const polygonText = geoEditState[zone.id]?.polygonText ?? JSON.stringify(zone.polygon, null, 2);
              return (
                <motion.div key={zone.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                  <Card>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: edited.color }} />
                        <span className="font-semibold text-sm">{edited.zone_name}</span>
                        <span className="text-xs font-mono text-muted-foreground px-1.5 py-0.5 rounded bg-secondary">{edited.zone_key}</span>
                        <span className="text-xs text-muted-foreground ml-auto">{zone.polygon.length} vertices</span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Zone Key</Label>
                          <Input value={edited.zone_key} onChange={(e) => handleGeoChange(zone.id, "zone_key", e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Display Name</Label>
                          <Input value={edited.zone_name} onChange={(e) => handleGeoChange(zone.id, "zone_name", e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Color</Label>
                          <div className="flex gap-2">
                            <input type="color" value={edited.color} onChange={(e) => handleGeoChange(zone.id, "color", e.target.value)} className="h-9 w-12 rounded border border-border cursor-pointer" />
                            <Input value={edited.color} onChange={(e) => handleGeoChange(zone.id, "color", e.target.value)} className="flex-1" />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Polygon Coordinates (JSON)</Label>
                        <Textarea
                          rows={4}
                          value={polygonText}
                          onChange={(e) => handleGeoChange(zone.id, "polygonText", e.target.value)}
                          className="font-mono text-xs"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" disabled={!isGeoDirty(zone.id)} onClick={() => handleGeoSave(zone)}>
                          <Save className="h-4 w-4 mr-1" /> Save
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => confirmDelete(edited.zone_name, () => deleteGeoMutation.mutate(zone.id))}>
                          <Trash2 className="h-4 w-4 text-destructive mr-1" /> Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminZones;
