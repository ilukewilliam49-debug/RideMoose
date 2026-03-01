import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";

interface ProfileRow {
  id: string;
  user_id: string;
  full_name: string;
  role: "rider" | "driver" | "admin";
  is_available: boolean | null;
  can_courier: boolean;
  pet_approved: boolean;
  vehicle_type: string | null;
}

const ROLES = ["rider", "driver", "admin"] as const;
const VEHICLE_TYPES = [
  { value: "none", label: "None" },
  { value: "sedan", label: "Sedan" },
  { value: "SUV", label: "SUV" },
  { value: "van", label: "Van" },
  { value: "truck", label: "Truck" },
] as const;

const AdminUsers = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const fetchProfiles = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, user_id, full_name, role, is_available, can_courier, pet_approved, vehicle_type")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Error loading users", description: error.message, variant: "destructive" });
    } else {
      setProfiles(data as ProfileRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  const handleCourierToggle = async (profileId: string, enabled: boolean) => {
    setSaving(profileId);
    const { error } = await supabase
      .from("profiles")
      .update({ can_courier: enabled })
      .eq("id", profileId);

    if (error) {
      toast({ title: "Failed to update courier capability", description: error.message, variant: "destructive" });
    } else {
      setProfiles((prev) =>
        prev.map((p) => (p.id === profileId ? { ...p, can_courier: enabled } : p))
      );
      toast({ title: enabled ? "Courier enabled" : "Courier disabled" });
    }
    setSaving(null);
  };
  const handlePetApprovedToggle = async (profileId: string, enabled: boolean) => {
    setSaving(profileId);
    const { error } = await supabase
      .from("profiles")
      .update({ pet_approved: enabled })
      .eq("id", profileId);

    if (error) {
      toast({ title: "Failed to update pet approval", description: error.message, variant: "destructive" });
    } else {
      setProfiles((prev) =>
        prev.map((p) => (p.id === profileId ? { ...p, pet_approved: enabled } : p))
      );
      toast({ title: enabled ? "Pet transport enabled" : "Pet transport disabled" });
    }
    setSaving(null);
  };

  const handleVehicleTypeChange = async (profileId: string, vehicleType: string) => {
    setSaving(profileId);
    const { error } = await supabase
      .from("profiles")
      .update({ vehicle_type: vehicleType === "none" ? null : vehicleType })
      .eq("id", profileId);

    if (error) {
      toast({ title: "Failed to update vehicle type", description: error.message, variant: "destructive" });
    } else {
      setProfiles((prev) =>
        prev.map((p) => (p.id === profileId ? { ...p, vehicle_type: vehicleType === "none" ? null : vehicleType } : p))
      );
      toast({ title: "Vehicle type updated" });
    }
    setSaving(null);
  };

  const handleRoleChange = async (profileId: string, newRole: string) => {
    setSaving(profileId);
    const { error } = await supabase
      .from("profiles")
      .update({ role: newRole as ProfileRow["role"] })
      .eq("id", profileId);

    if (error) {
      toast({ title: "Failed to update role", description: error.message, variant: "destructive" });
    } else {
      setProfiles((prev) =>
        prev.map((p) => (p.id === profileId ? { ...p, role: newRole as ProfileRow["role"] } : p))
      );
      toast({ title: "Role updated successfully" });
    }
    setSaving(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin")} className="shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-muted-foreground text-sm">View and manage all user accounts</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-pulse-glow w-8 h-8 rounded-full bg-primary" />
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>ID</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Courier</TableHead>
                <TableHead>Pet</TableHead>
                <TableHead>Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.full_name || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">
                    {p.id.slice(0, 8)}…
                  </TableCell>
                  <TableCell>
                    <Select
                      value={p.role}
                      onValueChange={(val) => handleRoleChange(p.id, val)}
                      disabled={saving === p.id || p.user_id === profile?.user_id}
                    >
                      <SelectTrigger className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map((r) => (
                          <SelectItem key={r} value={r} className="capitalize">
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {p.role === "driver" ? (
                      <Select
                        value={p.vehicle_type || "none"}
                        onValueChange={(val) => handleVehicleTypeChange(p.id, val)}
                        disabled={saving === p.id}
                      >
                        <SelectTrigger className="w-24">
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent>
                          {VEHICLE_TYPES.map((vt) => (
                            <SelectItem key={vt.value} value={vt.value}>
                              {vt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {p.role === "driver" ? (
                      <Switch
                        checked={p.can_courier}
                        onCheckedChange={(checked) => handleCourierToggle(p.id, checked)}
                        disabled={saving === p.id}
                      />
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {p.role === "driver" ? (
                      <Switch
                        checked={p.pet_approved}
                        onCheckedChange={(checked) => handlePetApprovedToggle(p.id, checked)}
                        disabled={saving === p.id}
                      />
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell>{p.is_available ? "Yes" : "No"}</TableCell>
                </TableRow>
              ))}
              {profiles.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No users found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default AdminUsers;
