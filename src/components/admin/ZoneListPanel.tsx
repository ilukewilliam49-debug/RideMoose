import { useState } from "react";
import { Plus, Save, Trash2, Pencil, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";

interface GeoZone {
  id: string;
  zone_key: string;
  zone_name: string;
  polygon: [number, number][];
  color: string;
  created_at: string;
}

interface ZoneListPanelProps {
  geoZones: GeoZone[];
  selectedZoneId: string | null;
  onSelectZone: (id: string | null) => void;
  onSave: (id: string, data: { zone_key: string; zone_name: string; color: string; polygon: [number, number][] }) => void;
  onDelete: (id: string, name: string) => void;
  onCreate: (data: { zone_key: string; zone_name: string; color: string; polygon: [number, number][] }) => void;
  pendingPolygon: [number, number][] | null;
  onClearPendingPolygon: () => void;
}

export default function ZoneListPanel({
  geoZones,
  selectedZoneId,
  onSelectZone,
  onSave,
  onDelete,
  onCreate,
  pendingPolygon,
  onClearPendingPolygon,
}: ZoneListPanelProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<{ zone_key: string; zone_name: string; color: string }>({ zone_key: "", zone_name: "", color: "#3b82f6" });
  const [showAdd, setShowAdd] = useState(false);
  const [newZone, setNewZone] = useState({ zone_key: "", zone_name: "", color: "#3b82f6" });

  const startEdit = (zone: GeoZone) => {
    setEditingId(zone.id);
    setEditData({ zone_key: zone.zone_key, zone_name: zone.zone_name, color: zone.color });
    onSelectZone(zone.id);
  };

  const saveEdit = (zone: GeoZone) => {
    onSave(zone.id, { ...editData, polygon: zone.polygon });
    setEditingId(null);
  };

  const handleCreate = () => {
    if (!pendingPolygon || pendingPolygon.length < 3) return;
    onCreate({ ...newZone, polygon: pendingPolygon });
    setNewZone({ zone_key: "", zone_name: "", color: "#3b82f6" });
    setShowAdd(false);
    onClearPendingPolygon();
  };

  // Auto-show add form when polygon is drawn
  const shouldShowAdd = showAdd || (pendingPolygon && pendingPolygon.length >= 3);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <h3 className="text-sm font-semibold">Geofence Zones ({geoZones.length})</h3>
        <Button size="sm" variant="ghost" onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {shouldShowAdd && (
        <div className="p-3 border-b bg-muted/30 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            {pendingPolygon ? `New polygon drawn (${pendingPolygon.length} vertices)` : "Draw a polygon on the map first"}
          </p>
          <div className="space-y-1.5">
            <Input
              placeholder="Zone key (e.g. airport)"
              value={newZone.zone_key}
              onChange={(e) => setNewZone({ ...newZone, zone_key: e.target.value })}
              className="h-8 text-xs"
            />
            <Input
              placeholder="Display name"
              value={newZone.zone_name}
              onChange={(e) => setNewZone({ ...newZone, zone_name: e.target.value })}
              className="h-8 text-xs"
            />
            <div className="flex gap-1.5">
              <input
                type="color"
                value={newZone.color}
                onChange={(e) => setNewZone({ ...newZone, color: e.target.value })}
                className="h-8 w-10 rounded border border-input cursor-pointer"
              />
              <Input
                value={newZone.color}
                onChange={(e) => setNewZone({ ...newZone, color: e.target.value })}
                className="h-8 text-xs flex-1"
              />
            </div>
          </div>
          <div className="flex gap-1.5">
            <Button size="sm" className="h-7 text-xs" disabled={!newZone.zone_key || !newZone.zone_name || !pendingPolygon} onClick={handleCreate}>
              Create
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setShowAdd(false); onClearPendingPolygon(); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <ScrollArea className="flex-1">
        <div className="divide-y">
          {geoZones.map((zone) => {
            const isSelected = zone.id === selectedZoneId;
            const isEditing = editingId === zone.id;

            return (
              <div
                key={zone.id}
                className={`p-3 cursor-pointer transition-colors ${isSelected ? "bg-accent/50" : "hover:bg-muted/50"}`}
                onClick={() => onSelectZone(zone.id)}
              >
                {isEditing ? (
                  <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
                    <Input value={editData.zone_key} onChange={(e) => setEditData({ ...editData, zone_key: e.target.value })} className="h-7 text-xs" />
                    <Input value={editData.zone_name} onChange={(e) => setEditData({ ...editData, zone_name: e.target.value })} className="h-7 text-xs" />
                    <div className="flex gap-1.5">
                      <input type="color" value={editData.color} onChange={(e) => setEditData({ ...editData, color: e.target.value })} className="h-7 w-8 rounded border border-input cursor-pointer" />
                      <Input value={editData.color} onChange={(e) => setEditData({ ...editData, color: e.target.value })} className="h-7 text-xs flex-1" />
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" className="h-6 text-xs px-2" onClick={() => saveEdit(zone)}>
                        <Save className="h-3 w-3 mr-1" /> Save
                      </Button>
                      <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => setEditingId(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full shrink-0 border border-border" style={{ backgroundColor: zone.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{zone.zone_name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{zone.zone_key} · {zone.polygon.length} pts</p>
                    </div>
                    <div className="flex gap-0.5 shrink-0">
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); startEdit(zone); }}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); onDelete(zone.id, zone.zone_name); }}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {geoZones.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">
              <MapPin className="h-8 w-8 mx-auto mb-2 opacity-40" />
              No zones defined yet. Draw a polygon on the map to create one.
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
