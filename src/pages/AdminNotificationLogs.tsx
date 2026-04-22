import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, Bell, CheckCircle, XCircle, Activity } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { AreaChart, Area, XAxis, YAxis, PieChart, Pie, Cell, ResponsiveContainer, CartesianGrid } from "recharts";

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

const deliveryChartConfig: ChartConfig = {
  delivered: { label: "Delivered", color: "hsl(142, 71%, 45%)" },
  failed: { label: "Failed", color: "hsl(0, 84%, 60%)" },
};

const PIE_COLORS = [
  "hsl(var(--primary))",
  "hsl(142, 71%, 45%)",
  "hsl(48, 96%, 53%)",
  "hsl(0, 84%, 60%)",
  "hsl(var(--muted-foreground))",
];

const methodChartConfig: ChartConfig = {
  push: { label: "Push", color: PIE_COLORS[0] },
  push_batch: { label: "Batch Push", color: PIE_COLORS[1] },
  sms: { label: "SMS", color: PIE_COLORS[2] },
  none: { label: "None", color: PIE_COLORS[3] },
};

export default function AdminNotificationLogs() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [eventFilter, setEventFilter] = useState<string>("all");
  const queryClient = useQueryClient();

  // All logs for charts (unfiltered)
  const { data: allLogs = [] } = useQuery({
    queryKey: ["notification-logs-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification_logs")
        .select("status, method, created_at")
        .order("created_at", { ascending: true })
        .limit(1000);
      if (error) throw error;
      return (data || []) as Array<{ status: string; method: string; created_at: string }>;
    },
  });

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

  // Delivery rate over time (grouped by day)
  const deliveryOverTime = useMemo(() => {
    if (!allLogs.length) return [];
    const dayMap = new Map<string, { delivered: number; failed: number }>();
    for (const log of allLogs) {
      const day = log.created_at.slice(0, 10);
      const entry = dayMap.get(day) || { delivered: 0, failed: 0 };
      if (log.status === "delivered") entry.delivered++;
      else if (["failed", "permanently_failed"].includes(log.status)) entry.failed++;
      dayMap.set(day, entry);
    }
    return Array.from(dayMap.entries())
      .map(([date, counts]) => ({ date, ...counts }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [allLogs]);

  // Method breakdown for pie chart
  const methodBreakdown = useMemo(() => {
    if (!allLogs.length) return [];
    const counts = new Map<string, number>();
    for (const log of allLogs) {
      counts.set(log.method, (counts.get(log.method) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([method, count]) => ({ method, count }))
      .sort((a, b) => b.count - a.count);
  }, [allLogs]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("notification-logs-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "notification_logs" }, () => {
        queryClient.invalidateQueries({ queryKey: ["notification-logs"] });
        queryClient.invalidateQueries({ queryKey: ["notification-logs-all"] });
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

  const hasChartData = allLogs.length > 0;

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

      {/* Analytics Charts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Delivery rate over time — area chart */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Delivery Rate Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            {hasChartData ? (
              <ChartContainer config={deliveryChartConfig} className="h-[220px] w-full">
                <AreaChart data={deliveryOverTime} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} className="text-muted-foreground" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} className="text-muted-foreground" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area type="monotone" dataKey="delivered" stackId="1" fill="hsl(142, 71%, 45%)" stroke="hsl(142, 71%, 45%)" fillOpacity={0.4} />
                  <Area type="monotone" dataKey="failed" stackId="1" fill="hsl(0, 84%, 60%)" stroke="hsl(0, 84%, 60%)" fillOpacity={0.4} />
                </AreaChart>
              </ChartContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
                No data yet — charts will appear once notifications are sent.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Method breakdown — pie chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Delivery Method Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {hasChartData ? (
              <ChartContainer config={methodChartConfig} className="h-[220px] w-full">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Pie
                    data={methodBreakdown}
                    dataKey="count"
                    nameKey="method"
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={2}
                    label={({ method, count }) => `${method} (${count})`}
                    labelLine={false}
                  >
                    {methodBreakdown.map((entry, i) => (
                      <Cell key={entry.method} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
                No data yet
              </div>
            )}
          </CardContent>
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
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Event" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All events</SelectItem>
            <SelectItem value="dispatch.attempt">Dispatch — attempt</SelectItem>
            <SelectItem value="dispatch.outcome">Dispatch — outcome</SelectItem>
            <SelectItem value="dispatch.resolved">Dispatch — resolved</SelectItem>
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
                    <TableCell className="text-xs text-destructive max-w-[200px] truncate" title={log.error_message || ""}>
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
