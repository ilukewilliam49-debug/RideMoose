import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Save, Plus, Trash2, MapPinned } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Zone {
  id: string;
  zone_name: string;
  pickup_zone: string;
  dropoff_zone: string;
  flat_fare_cents: number;
  active: boolean;
  created_at: string;
}

const AdminZones = () => {
  const queryClient = useQueryClient();
  const [editState, setEditState] = useState<Record<string, Partial<Zone>>>({});
  const [newZone, setNewZone] = useState({ zone_name: "", pickup_zone: "", dropoff_zone: "", flat_fare_cents: 5000 });

  const { data: zones, isLoading } = useQuery({
    queryKey: ["admin-zones"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("private_hire_zones")
        .select("*")
        .order("zone_name");
      if (error) throw error;
      return data as Zone[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (zone: Zone) => {
      const { id, created_at, ...updates } = zone;
      const { error } = await supabase.from("private_hire_zones").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-zones"] });
      toast.success("Zone updated!");
    },
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-zones"] });
      toast.success("Zone deleted!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleChange = (id: string, field: keyof Zone, value: any) => {
    setEditState((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const getEdited = (zone: Zone): Zone => ({ ...zone, ...(editState[zone.id] || {}) });
  const isDirty = (id: string) => !!editState[id] && Object.keys(editState[id]).length > 0;

  const handleSave = (zone: Zone) => {
    updateMutation.mutate(getEdited(zone));
    setEditState((prev) => { const next = { ...prev }; delete next[zone.id]; return next; });
  };

  if (isLoading) return <div className="py-8 text-center text-muted-foreground">Loading zones…</div>;

  return (
    <div className="space-y-6 pt-4">
      <h1 className="text-2xl font-bold">Private Hire Zones</h1>

      {/* Add new zone */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" /> Add Zone
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Zone Name</Label>
              <Input value={newZone.zone_name} onChange={(e) => setNewZone({ ...newZone, zone_name: e.target.value })} placeholder="e.g. Airport Transfer" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Fare (cents)</Label>
              <Input type="number" value={newZone.flat_fare_cents} onChange={(e) => setNewZone({ ...newZone, flat_fare_cents: parseInt(e.target.value) || 0 })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Pickup Zone</Label>
              <Input value={newZone.pickup_zone} onChange={(e) => setNewZone({ ...newZone, pickup_zone: e.target.value })} placeholder="e.g. city, airport" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Dropoff Zone</Label>
              <Input value={newZone.dropoff_zone} onChange={(e) => setNewZone({ ...newZone, dropoff_zone: e.target.value })} placeholder="e.g. airport, ingraham_trail" />
            </div>
          </div>
          <Button size="sm" onClick={() => createMutation.mutate(newZone)} disabled={!newZone.zone_name || !newZone.pickup_zone || !newZone.dropoff_zone || createMutation.isPending}>
            <Plus className="h-4 w-4 mr-1" /> Create Zone
          </Button>
        </CardContent>
      </Card>

      {/* Existing zones */}
      <div className="space-y-3">
        {zones?.map((zone) => {
          const edited = getEdited(zone);
          return (
            <motion.div key={zone.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <Card>
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Zone Name</Label>
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
                      <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(zone.id)}>
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
    </div>
  );
};

export default AdminZones;
