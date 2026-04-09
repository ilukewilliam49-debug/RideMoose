import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, Calendar, Users, AlertTriangle, CheckCircle, Loader2, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { format } from "date-fns";

export default function AdminBookings() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: syncStatus } = useQuery({
    queryKey: ["bokun-sync-status"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bokun_sync_status" as any)
        .select("*")
        .eq("resource_type", "bookings")
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    refetchInterval: 5000,
  });

  const { data: bookings, isLoading } = useQuery({
    queryKey: ["bokun-bookings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bokun_bookings" as any)
        .select("*")
        .order("booking_date", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("sync-bokun-bookings");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Synced ${data.synced} bookings from Bókun`);
      queryClient.invalidateQueries({ queryKey: ["bokun-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["bokun-sync-status"] });
    },
    onError: (err: any) => {
      toast.error(`Sync failed: ${err.message}`);
      queryClient.invalidateQueries({ queryKey: ["bokun-sync-status"] });
    },
  });

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      CONFIRMED: "bg-green-100 text-green-800",
      CANCELLED: "bg-red-100 text-red-800",
      PENDING: "bg-yellow-100 text-yellow-800",
    };
    return <Badge className={map[status] || "bg-muted text-muted-foreground"}>{status}</Badge>;
  };

  const isSyncing = syncStatus?.status === "running" || syncMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Bókun Bookings</h1>
        <Button onClick={() => syncMutation.mutate()} disabled={isSyncing}>
          {isSyncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          {isSyncing ? "Syncing…" : "Sync Now"}
        </Button>
      </div>

      {/* Sync Status Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Sync Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              {syncStatus?.status === "completed" ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : syncStatus?.status === "error" ? (
                <AlertTriangle className="h-4 w-4 text-destructive" />
              ) : syncStatus?.status === "running" ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              ) : null}
              <span className="text-sm font-medium capitalize">{syncStatus?.status || "Never synced"}</span>
            </div>
            {syncStatus?.last_synced_at && (
              <span className="text-xs text-muted-foreground">
                Last synced: {format(new Date(syncStatus.last_synced_at), "PPp")}
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              Total synced: {syncStatus?.total_synced || 0}
            </span>
            {syncStatus?.error_message && (
              <p className="text-xs text-destructive w-full mt-1">{syncStatus.error_message}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Bookings Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : !bookings?.length ? (
            <div className="text-center p-8 text-muted-foreground">
              No bookings synced yet. Click "Sync Now" to fetch from Bókun.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Confirmation</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Participants</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.map((b: any) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-mono text-xs">{b.confirmation_code || b.bokun_booking_id}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{b.product_title || "—"}</TableCell>
                    <TableCell>
                      <div>{b.customer_name || "—"}</div>
                      {b.customer_email && (
                        <div className="text-xs text-muted-foreground">{b.customer_email}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      {b.booking_date ? format(new Date(b.booking_date), "PP") : "—"}
                      {b.start_time && <div className="text-xs text-muted-foreground">{b.start_time}</div>}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {b.participants}
                      </div>
                    </TableCell>
                    <TableCell>
                      {b.total_price_cents
                        ? `${(b.total_price_cents / 100).toLocaleString()} ${b.currency}`
                        : "—"}
                    </TableCell>
                    <TableCell>{statusBadge(b.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
