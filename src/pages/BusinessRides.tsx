import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Car } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import EmptyState from "@/components/EmptyState";

const formatMoney = (n: number | null | undefined) =>
  `$${(Number(n ?? 0)).toFixed(2)}`;

const statusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
  if (status === "completed") return "default";
  if (status === "cancelled") return "destructive";
  if (status === "in_progress" || status === "accepted" || status === "arrived") return "secondary";
  return "outline";
};

const BusinessRides = () => {
  const { profile } = useAuth();

  const { data: orgId } = useQuery({
    queryKey: ["business-org-id", profile?.user_id],
    queryFn: async () => {
      if (!profile?.user_id) return null;
      const { data } = await supabase
        .from("org_members")
        .select("organization_id")
        .eq("user_id", profile.user_id)
        .maybeSingle();
      return data?.organization_id || profile.organization_id || null;
    },
    enabled: !!profile?.user_id,
  });

  const { data: rides, isLoading } = useQuery({
    queryKey: ["business-rides", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await supabase
        .from("rides")
        .select(
          "id, created_at, status, service_type, pickup_address, dropoff_address, final_price, estimated_price, rider_id",
        )
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (!data?.length) return [];
      const riderIds = Array.from(new Set(data.map((r) => r.rider_id).filter(Boolean)));
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", riderIds as string[]);
      const byId = new Map(profs?.map((p) => [p.id, p.full_name]) || []);
      return data.map((r) => ({ ...r, rider_name: byId.get(r.rider_id) || "—" }));
    },
    enabled: !!orgId,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Car className="h-6 w-6 text-primary" />
          Ride history
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          All rides billed to your organization (latest 100).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent rides</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : !rides?.length ? (
            <EmptyState
              icon={Car}
              title="No rides yet"
              description="Rides booked on your organization account will appear here."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Rider</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Fare</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rides.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm whitespace-nowrap">
                      {new Date(r.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-sm">{r.rider_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize text-xs">
                        {String(r.service_type).replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                      {r.pickup_address} → {r.dropoff_address}
                    </TableCell>
                    <TableCell className="font-mono">
                      {formatMoney(r.final_price ?? r.estimated_price)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(r.status)} className="capitalize text-xs">
                        {String(r.status).replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BusinessRides;
