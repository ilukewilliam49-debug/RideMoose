import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AdminBreadcrumb from "@/components/admin/AdminBreadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { User, Phone, Car, CalendarDays, MapPin, Shield, PawPrint, Package, Utensils, Bus, Briefcase, Pencil, Check, X, Percent } from "lucide-react";
import ErrorRetry from "@/components/driver/ErrorRetry";
import { format } from "date-fns";
import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";

const ROLES = ["rider", "driver", "admin"] as const;
const VEHICLE_TYPES = ["sedan", "SUV", "van", "truck"] as const;

function InlineEdit({ value, onSave, icon: Icon, label, type = "text", suffix }: {
  value: string;
  onSave: (val: string) => void;
  icon: React.ElementType;
  label: string;
  type?: string;
  suffix?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const commit = () => {
    setEditing(false);
    if (draft !== value) onSave(draft);
  };

  const cancel = () => {
    setEditing(false);
    setDraft(value);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
        <Input
          autoFocus
          type={type}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") cancel(); }}
          className="h-8 text-sm"
        />
        {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
        <button onClick={commit} className="text-primary"><Check className="h-4 w-4" /></button>
        <button onClick={cancel} className="text-muted-foreground"><X className="h-4 w-4" /></button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 group cursor-pointer" onClick={() => { setDraft(value); setEditing(true); }}>
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm">{value || `No ${label.toLowerCase()}`}</span>
      <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}

export default function AdminUserDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const { data: profile, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-user-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: rides } = useQuery({
    queryKey: ["admin-user-rides", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rides")
        .select("id, status, service_type, pickup_address, dropoff_address, created_at, final_price")
        .or(`rider_id.eq.${id},driver_id.eq.${id}`)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: verifications } = useQuery({
    queryKey: ["admin-user-verifications", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("verifications")
        .select("*")
        .eq("driver_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id && profile?.role === "driver",
  });

  const handleUpdate = async (field: string, value: any) => {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ [field]: value })
      .eq("id", id!);
    if (error) {
      toast.error(`Failed to update: ${error.message}`);
    } else {
      toast.success(`${field.replace(/_/g, " ")} updated`);
      queryClient.invalidateQueries({ queryKey: ["admin-user-detail", id] });
    }
    setSaving(false);
  };

  const statusColor: Record<string, string> = {
    completed: "bg-green-500/10 text-green-500",
    in_progress: "bg-blue-500/10 text-blue-500",
    requested: "bg-yellow-500/10 text-yellow-500",
    cancelled: "bg-destructive/10 text-destructive",
    accepted: "bg-primary/10 text-primary",
    dispatched: "bg-primary/10 text-primary",
  };

  const verificationStatusColor: Record<string, string> = {
    pending: "bg-yellow-500/10 text-yellow-500",
    approved: "bg-green-500/10 text-green-500",
    rejected: "bg-destructive/10 text-destructive",
  };

  if (isError) {
    return (
      <div className="space-y-6">
        <AdminBreadcrumb segmentLabels={{ users: "Users" }} pageTitle="User Not Found" />
        <ErrorRetry message="Failed to load user details" onRetry={() => refetch()} />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <AdminBreadcrumb segmentLabels={{ users: "Users" }} pageTitle="Loading..." />
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminBreadcrumb
        segmentLabels={{ users: "Users" }}
        pageTitle={profile?.full_name || "User Detail"}
      />

      {/* User Header */}
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <User className="h-7 w-7 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{profile?.full_name || "Unnamed User"}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="capitalize">{profile?.role}</Badge>
            {profile?.is_available && (
              <Badge className="bg-green-500/10 text-green-500">Online</Badge>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Basic Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{profile?.phone || "No phone"}</span>
              {profile?.phone_verified && (
                <Badge variant="outline" className="text-xs">Verified</Badge>
              )}
            </div>
            <div className="flex items-center gap-3">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Joined {profile?.created_at ? format(new Date(profile.created_at), "PPP") : "—"}</span>
            </div>
            {profile?.latitude && profile?.longitude && (
              <div className="flex items-center gap-3">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {profile.latitude.toFixed(4)}, {profile.longitude.toFixed(4)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between pt-2">
              <Label htmlFor="role-select" className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                Role
              </Label>
              <Select
                value={profile?.role}
                onValueChange={(val) => handleUpdate("role", val)}
                disabled={saving}
              >
                <SelectTrigger className="w-28" id="role-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Driver Capabilities */}
        {profile?.role === "driver" && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Driver Capabilities</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Car className="h-4 w-4 text-muted-foreground" /> Vehicle
                </Label>
                <Select
                  value={profile.vehicle_type || "none"}
                  onValueChange={(val) => handleUpdate("vehicle_type", val === "none" ? null : val)}
                  disabled={saving}
                >
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {VEHICLE_TYPES.map((vt) => (
                      <SelectItem key={vt} value={vt}>{vt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {[
                { field: "can_taxi", label: "Taxi", icon: Car },
                { field: "can_courier", label: "Courier", icon: Package },
                { field: "can_food_delivery", label: "Food Delivery", icon: Utensils },
                { field: "can_shuttle", label: "Shuttle", icon: Bus },
                { field: "can_private_hire", label: "Private Hire", icon: Briefcase },
                { field: "pet_approved", label: "Pet Approved", icon: PawPrint },
              ].map(({ field, label, icon: Icon }) => (
                <div key={field} className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" /> {label}
                  </Label>
                  <Switch
                    checked={(profile as any)[field] || false}
                    onCheckedChange={(checked) => handleUpdate(field, checked)}
                    disabled={saving}
                  />
                </div>
              ))}
              <div className="pt-2 border-t space-y-1 text-sm text-muted-foreground">
                <p>Commission: {((profile.commission_rate || 0) * 100).toFixed(1)}%</p>
                <p>Balance: {(profile.driver_balance_cents / 100).toLocaleString()} ISK</p>
                {profile.seat_capacity && <p>Seats: {profile.seat_capacity}</p>}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Verifications (Driver only) */}
        {profile?.role === "driver" && verifications && verifications.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Verifications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {verifications.map((v) => (
                <div key={v.id} className="flex items-center justify-between text-sm">
                  <span className="capitalize">{v.document_type.replace(/_/g, " ")}</span>
                  <Badge className={verificationStatusColor[v.status] || ""}>
                    {v.status}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Recent Rides */}
        <Card className={profile?.role !== "driver" ? "md:col-span-2" : ""}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Recent Rides</CardTitle>
          </CardHeader>
          <CardContent>
            {!rides?.length ? (
              <p className="text-sm text-muted-foreground">No rides found</p>
            ) : (
              <div className="space-y-3">
                {rides.map((r) => (
                  <div key={r.id} className="flex items-start justify-between gap-2 text-sm border-b pb-2 last:border-0">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{r.pickup_address}</p>
                      <p className="text-muted-foreground truncate">→ {r.dropoff_address}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {format(new Date(r.created_at), "PP")} · {r.service_type}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <Badge className={statusColor[r.status] || ""}>{r.status}</Badge>
                      {r.final_price != null && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {Number(r.final_price).toLocaleString()} ISK
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
