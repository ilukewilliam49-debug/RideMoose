import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Search } from "lucide-react";
import AdminBreadcrumb from "@/components/admin/AdminBreadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
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
  role: "rider" | "driver" | "admin";
  is_available: boolean | null;
  can_courier: boolean;
  pet_approved: boolean;
  vehicle_type: string | null;
  created_at: string;
}

const ROLES = ["rider", "driver", "admin"] as const;
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [page, setPage] = useState(0);

  // Confirmation dialog state
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    description: string;
    onConfirm: () => void;
  } | null>(null);

  const fetchProfiles = async () => {
    setError(false);
    setLoading(true);
    const { data, error: err } = await supabase
      .from("profiles")
      .select("id, user_id, full_name, phone, role, is_available, can_courier, pet_approved, vehicle_type, created_at")
      .order("created_at", { ascending: false });

    if (err) {
      setError(true);
      toast({ title: "Error loading users", description: err.message, variant: "destructive" });
    } else {
      setProfiles(data as ProfileRow[]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchProfiles(); }, []);

  const filtered = useMemo(() => {
    let result = profiles;
    if (roleFilter !== "all") result = result.filter((p) => p.role === roleFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.full_name?.toLowerCase().includes(q) ||
          p.phone?.toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q)
      );
    }
    return result;
  }, [profiles, roleFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  useEffect(() => { setPage(0); }, [search, roleFilter]);

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

  const handleRoleChange = (profileId: string, newRole: string) => {
    setConfirmAction({
      title: "Change user role?",
      description: `This will change the user's role to "${newRole}". This affects their access and permissions across the platform.`,
      onConfirm: () => handleUpdate(profileId, "role", newRole),
    });
  };

  return (
    <div className="space-y-6">
      {/* Confirm dialog */}
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

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin")} className="shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-muted-foreground text-sm">View and manage all user accounts</p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, phone, or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="All roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {ROLES.map((r) => (
              <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
            ))}
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
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Courier</TableHead>
                  <TableHead>Pet</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.full_name || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.phone || "—"}</TableCell>
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
                            <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {p.role === "driver" ? (
                        <Select
                          value={p.vehicle_type || "none"}
                          onValueChange={(val) => handleUpdate(p.id, "vehicle_type", val === "none" ? null : val)}
                          disabled={saving === p.id}
                        >
                          <SelectTrigger className="w-24">
                            <SelectValue placeholder="—" />
                          </SelectTrigger>
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
                    <TableCell>
                      {p.role === "driver" ? (
                        <Switch
                          checked={p.can_courier}
                          onCheckedChange={(checked) => handleUpdate(p.id, "can_courier", checked)}
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
                          onCheckedChange={(checked) => handleUpdate(p.id, "pet_approved", checked)}
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
                {paginated.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No users found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{filtered.length} user{filtered.length !== 1 ? "s" : ""}</span>
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
