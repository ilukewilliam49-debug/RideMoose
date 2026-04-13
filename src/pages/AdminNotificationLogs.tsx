import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, Bell, CheckCircle, XCircle, Clock, Activity } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface NotificationLog {
  id: string;
  ride_id: string | null;
  target_profile_id: string | null;
  event: string;
  method: string;
  status: string;
  error_message: string | null;
  onesignal_id: string | null;
  recipients: number;
  retry_count: number;
  metadata: Record<string, unknown>;
  created_at: string;
  completed_at: string | null;
}

const statusColors: Record<string, string> = {
  delivered: "bg-green-500/10 text-green-600 border-green-200",
  failed: "bg-red-500/10 text-red-600 border-red-200",
  permanently_failed: "bg-red-800/10 text-red-800 border-red-300",
  pending: "bg-yellow-500/10 text-yellow-600 border-yellow-200",
  skipped: "bg-muted text-muted-foreground border-border",
};

const methodIcons: Record<string, string> = {
  push: "📲",
  push_batch: "📡",
  sms: "💬",
  none: "—",
};

export default function AdminNotificationLogs() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [eventFilter, setEventFilter] = useState<string>("all");
  const queryClient = useQueryClient();

  const { data: logs = [], isLoading, refetch } = useQuery({
    queryKey: ["notification-logs", statusFilter, eventFilter],
    queryFn: async () => {
      let query = supabase
        .from("notification_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      if (eventFilter !== "all") query = query.eq("event", eventFilter);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as NotificationLog[];
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["notification-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification_logs")
        .select("status");
      if (error) throw error;
      const total = data?.length || 0;
      const delivered = data?.filter(l => l.status === "delivered").length || 0;
      const failed = data?.filter(l => ["failed", "permanently_failed"].includes(l.status)).length || 0;
      const pending = data?.filter(l => l.status === "pending").length || 0;
      return { total, delivered, failed, pending, rate: total > 0 ? Math.round((delivered / total) * 100) : 0 };
    },
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("notification-logs-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "notification_logs" }, () => {
        queryClient.invalidateQueries({ queryKey: ["notification-logs"] });
        queryClient.invalidateQueries({ queryKey: ["notification-stats"] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const handleRetryQueue = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("send-push-notification", {
        body: { mode: "retry" },
      });
      if (error) throw error;
      toast.success(`Retry complete: ${data.succeeded}/${data.processed} succeeded`);
      refetch();
    } catch (e: any) {
      toast.error("Retry failed: " + e.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Notification Logs</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          <Button variant="default" size="sm" onClick={handleRetryQueue}>
            <Activity className="h-4 w-4 mr-1" /> Process Retry Queue
          </Button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Sent</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{stats?.total || 0}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-1"><CheckCircle className="h-4 w-4 text-green-500" /> Delivered</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-green-600">{stats?.delivered || 0}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-1"><XCircle className="h-4 w-4 text-red-500" /> Failed</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-red-600">{stats?.failed || 0}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-1"><Bell className="h-4 w-4" /> Success Rate</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{stats?.rate || 0}%</p></CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="permanently_failed">Perm. Failed</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="skipped">Skipped</SelectItem>
          </SelectContent>
        </Select>
        <Select value={eventFilter} onValueChange={setEventFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Event" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All events</SelectItem>
            <SelectItem value="requested">Requested</SelectItem>
            <SelectItem value="accepted">Accepted</SelectItem>
            <SelectItem value="arrived">Arrived</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="direct">Direct</SelectItem>
            <SelectItem value="test">Test</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Logs table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Recipients</TableHead>
                <TableHead>Retries</TableHead>
                <TableHead className="max-w-[200px]">Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : logs.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No logs yet</TableCell></TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{log.event}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {methodIcons[log.method] || log.method} {log.method}
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-xs ${statusColors[log.status] || ""}`}>
                        {log.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{log.recipients}</TableCell>
                    <TableCell className="text-sm">{log.retry_count > 0 ? log.retry_count : "—"}</TableCell>
                    <TableCell className="text-xs text-red-500 max-w-[200px] truncate" title={log.error_message || ""}>
                      {log.error_message || "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
