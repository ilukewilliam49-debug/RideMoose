import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Search, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import AdminBreadcrumb from "@/components/admin/AdminBreadcrumb";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import ErrorRetry from "@/components/driver/ErrorRetry";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ProfileRow {
  id: string;
  user_id: string;
  full_name: string;
  phone: string | null;
  is_rider: boolean;
  is_driver: boolean;
  is_business: boolean;
  is_available: boolean | null;
  can_courier: boolean;
  vehicle_type: string | null;
  created_at: string;
  isAdmin?: boolean;
}

const VEHICLE_TYPES = [
  { value: "none", label: "None" },
  { value: "sedan", label: "Sedan" },
  { value: "SUV", label: "SUV" },
  { value: "van", label: "Van" },
  { value: "truck", label: "Truck" },
] as const;

const PAGE_SIZE = 25;

const AdminUsers = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [vehicleFilter, setVehicleFilter] = useState<string>("all");
  const [onlineFilter, setOnlineFilter] = useState<string>("all");
  const [capabilityFilter, setCapabilityFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkSaving, setBulkSaving] = useState(false);

  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    description: string;
    onConfirm: () => void;
  } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchProfiles = useCallback(async () => {
    setError(false);
    setLoading(true);

    let query = supabase
      .from("profiles")
      .select(
        "id, user_id, full_name, phone, is_rider, is_driver, is_business, is_available, can_courier, vehicle_type, created_at",
        { count: "exact" },
      )
      .order("created_at", { ascending: false });

    if (roleFilter === "driver") query = query.eq("is_driver", true);
    else if (roleFilter === "rider") query = query.eq("is_rider", true).eq("is_driver", false).eq("is_business", false);
    else if (roleFilter === "business") query = query.eq("is_business", true);

    if (vehicleFilter !== "all") {
      if (vehicleFilter === "none") query = query.is("vehicle_type", null);
      else query = query.eq("vehicle_type", vehicleFilter);
    }
    if (onlineFilter === "online") query = query.eq("is_available", true);
    if (onlineFilter === "offline") query = query.eq("is_available", false);
    if (capabilityFilter === "courier") query = query.eq("can_courier", true);
    if (debouncedSearch.trim()) {
      query = query.ilike("full_name", `%${debouncedSearch.trim()}%`);
    }

    const from = page * PAGE_SIZE;
    query = query.range(from, from + PAGE_SIZE - 1);

    const { data, error: err, count } = await query;

    if (err) {
      setError(true);
      toast({ title: "Error loading users", description: err.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    const rows = (data || []) as ProfileRow[];
    const userIds = rows.map((r) => r.user_id);
    let adminSet = new Set<string>();
    if (userIds.length) {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin")
        .in("user_id", userIds);
      adminSet = new Set((roles || []).map((r) => r.user_id));
    }

    let withAdmin = rows.map((r) => ({ ...r, isAdmin: adminSet.has(r.user_id) }));
    if (roleFilter === "admin") withAdmin = withAdmin.filter((r) => r.isAdmin);

    setProfiles(withAdmin);
    setTotalCount(count || 0);
    setLoading(false);
  }, [roleFilter, vehicleFilter, onlineFilter, capabilityFilter, debouncedSearch, page]);

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

  useEffect(() => { setPage(0); setSelected(new Set()); }, [debouncedSearch, roleFilter, vehicleFilter, onlineFilter, capabilityFilter]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === profiles.length) setSelected(new Set());
    else setSelected(new Set(profiles.map((p) => p.id)));
  };

  const handleBulkUpdate = async (field: string, value: any) => {
    const ids = Array.from(selected).filter((id) => id !== profile?.id);
    if (!ids.length) return;
    setBulkSaving(true);
    const { error: err } = await supabase
      .from("profiles")
      .update({ [field]: value })
      .in("id", ids);
    if (err) {
      toast({ title: `Bulk update failed`, description: err.message, variant: "destructive" });
    } else {
      toast({ title: `Updated ${ids.length} user${ids.length > 1 ? "s" : ""}` });
      setSelected(new Set());
      fetchProfiles();
    }
    setBulkSaving(false);
  };

  const handleBulkAction = (field: string, value: any, label: string) => {
    const count = Array.from(selected).filter((id) => id !== profile?.id).length;
    setConfirmAction({
      title: `Apply to ${count} user${count > 1 ? "s" : ""}?`,
      description: `This will set ${label} for ${count} selected user${count > 1 ? "s" : ""}.`,
      onConfirm: () => handleBulkUpdate(field, value),
    });
  };

  const handleUpdate = async (profileId: string, field: string, value: any) => {
    setSaving(profileId);
    const { error: err } = await supabase
      .from("profiles")
      .update({ [field]: value })
      .eq("id", profileId);

    if (err) {
      toast({ title: `Failed to update ${field}`, description: err.message, variant: "destructive" });
    } else {
      setProfiles((prev) => prev.map((p) => (p.id === profileId ? { ...p, [field]: value } : p)));
      toast({ title: `${field.replace("_", " ")} updated` });
    }
    setSaving(null);
  };

  const toggleAdmin = async (row: ProfileRow) => {
    setSaving(row.id);
    if (row.isAdmin) {
      const { error: err } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", row.user_id)
        .eq("role", "admin");
      if (err) toast({ title: "Failed to revoke admin", description: err.message, variant: "destructive" });
      else {
        toast({ title: "Admin revoked" });
        setProfiles((prev) => prev.map((p) => (p.id === row.id ? { ...p, isAdmin: false } : p)));
      }
    } else {
      const { error: err } = await supabase
        .from("user_roles")
        .insert({ user_id: row.user_id, role: "admin" });
      if (err) toast({ title: "Failed to grant admin", description: err.message, variant: "destructive" });
      else {
        toast({ title: "Admin granted" });
        setProfiles((prev) => prev.map((p) => (p.id === row.id ? { ...p, isAdmin: true } : p)));
      }
    }
    setSaving(null);
  };

  const roleLabel = (p: ProfileRow) => {
    if (p.isAdmin) return "admin";
    if (p.is_driver) return "driver";
    if (p.is_business) return "business";
    return "rider";
  };

  return (
    <div className="space-y-6">
      <AlertDialog open={!!confirmAction} onOpenChange={(open) => { if (!open) setConfirmAction(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmAction?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmAction?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { confirmAction?.onConfirm(); setConfirmAction(null); }}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AdminBreadcrumb pageTitle="User Management" />
      <div>
        <h1 className="text-2xl font-bold">User Management</h1>
        <p className="text-muted-foreground text-sm">View and manage all user accounts</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="All roles" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            <SelectItem value="rider">Rider only</SelectItem>
            <SelectItem value="driver">Driver</SelectItem>
            <SelectItem value="business">Business</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
        <Select value={vehicleFilter} onValueChange={setVehicleFilter}>
          <SelectTrigger className="w-[120px]"><SelectValue placeholder="Vehicle" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All vehicles</SelectItem>
            {VEHICLE_TYPES.map((vt) => (
              <SelectItem key={vt.value} value={vt.value}>{vt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={onlineFilter} onValueChange={setOnlineFilter}>
          <SelectTrigger className="w-[120px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="online">Online</SelectItem>
            <SelectItem value="offline">Offline</SelectItem>
          </SelectContent>
        </Select>
        <Select value={capabilityFilter} onValueChange={setCapabilityFilter}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="Capability" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All capabilities</SelectItem>
            <SelectItem value="courier">Courier</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error ? (
        <ErrorRetry message="Failed to load users" onRetry={fetchProfiles} />
      ) : loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <>
          {selected.size > 0 && (
            <div className="flex items-center gap-3 rounded-lg border bg-muted/50 px-4 py-2 flex-wrap">
              <span className="text-sm font-medium">{selected.size} selected</span>
              <div className="h-4 w-px bg-border" />
              <Button variant="outline" size="sm" className="h-8 text-xs" disabled={bulkSaving}
                onClick={() => handleBulkAction("can_courier", true, "courier → enabled")}>
                Enable Courier
              </Button>
              <Button variant="outline" size="sm" className="h-8 text-xs" disabled={bulkSaving}
                onClick={() => handleBulkAction("is_driver", true, "driver capability → enabled")}>
                Enable Driver
              </Button>
              <Button variant="ghost" size="sm" className="h-8 text-xs ml-auto" onClick={() => setSelected(new Set())}>
                <X className="h-3 w-3 mr-1" /> Clear
              </Button>
            </div>
          )}

          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={profiles.length > 0 && selected.size === profiles.length}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Admin</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Courier</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.map((p) => (
                  <TableRow key={p.id} className={`cursor-pointer hover:bg-muted/50 ${selected.has(p.id) ? "bg-muted/30" : ""}`} onClick={() => navigate(`/admin/users/${p.id}`)}>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggleSelect(p.id)} />
                    </TableCell>
                    <TableCell className="font-medium">{p.full_name || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.phone || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">{roleLabel(p)}</Badge>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Switch
                        checked={!!p.isAdmin}
                        onCheckedChange={() => toggleAdmin(p)}
                        disabled={saving === p.id || p.user_id === profile?.user_id}
                      />
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {p.is_driver ? (
                        <Select
                          value={p.vehicle_type || "none"}
                          onValueChange={(val) => handleUpdate(p.id, "vehicle_type", val === "none" ? null : val)}
                          disabled={saving === p.id}
                        >
                          <SelectTrigger className="w-24"><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>
                            {VEHICLE_TYPES.map((vt) => (
                              <SelectItem key={vt.value} value={vt.value}>{vt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {p.is_driver ? (
                        <Switch
                          checked={p.can_courier}
                          onCheckedChange={(checked) => handleUpdate(p.id, "can_courier", checked)}
                          disabled={saving === p.id}
                        />
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell>{p.is_available ? "Yes" : "No"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(p.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
                {profiles.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      No users found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{totalCount} user{totalCount !== 1 ? "s" : ""}</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              <span>Page {page + 1} of {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminUsers;
