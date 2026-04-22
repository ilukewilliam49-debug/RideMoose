import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RefreshCw, Mail, CheckCircle, XCircle, AlertTriangle, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const FAILED_STATUSES = ["dlq", "failed", "bounced"];
const RESENDABLE_TEMPLATE_PREFIX = "driver-application";

interface EmailLog {
  id: string;
  message_id: string | null;
  template_name: string;
  recipient_email: string;
  status: string;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

const RANGE_OPTIONS = [
  { value: "24h", label: "Last 24 hours", hours: 24 },
  { value: "7d", label: "Last 7 days", hours: 24 * 7 },
  { value: "30d", label: "Last 30 days", hours: 24 * 30 },
  { value: "all", label: "All time", hours: null as number | null },
];

const statusBadgeClass = (status: string): string => {
  switch (status) {
    case "sent":
      return "bg-green-500/10 text-green-600 border-green-200";
    case "pending":
      return "bg-yellow-500/10 text-yellow-700 border-yellow-200";
    case "dlq":
    case "failed":
    case "bounced":
      return "bg-red-500/10 text-red-600 border-red-200";
    case "complained":
      return "bg-orange-500/10 text-orange-600 border-orange-200";
    case "suppressed":
      return "bg-muted text-muted-foreground border-border";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
};

/**
 * Deduplicate by message_id keeping the latest row per email.
 * Rows without a message_id are kept individually (treated as their own group).
 */
function dedupeByMessageId(rows: EmailLog[]): EmailLog[] {
  const latest = new Map<string, EmailLog>();
  for (const row of rows) {
    const key = row.message_id ?? `__no_mid_${row.id}`;
    const existing = latest.get(key);
    if (!existing || new Date(row.created_at) > new Date(existing.created_at)) {
      latest.set(key, row);
    }
  }
  return Array.from(latest.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export default function AdminEmailLogs() {
  const queryClient = useQueryClient();
  const [rangeKey, setRangeKey] = useState<string>("7d");
  const [templateFilter, setTemplateFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [pendingResend, setPendingResend] = useState<EmailLog | null>(null);

  const handleResend = async (log: EmailLog) => {
    setResendingId(log.id);
    try {
      const { error } = await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: log.template_name,
          recipientEmail: log.recipient_email,
          // Fresh idempotency key so the queue treats this as a new send
          idempotencyKey: `resend-${log.id}-${Date.now()}`,
        },
      });
      if (error) throw error;
      toast.success(`Resend queued for ${log.recipient_email}`);
      // Realtime will refresh, but trigger a refetch as a fallback
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["admin-email-logs"] });
      }, 1500);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to resend email";
      toast.error(message);
    } finally {
      setResendingId(null);
    }
  };

  const sinceIso = useMemo(() => {
    const opt = RANGE_OPTIONS.find((o) => o.value === rangeKey);
    if (!opt || opt.hours === null) return null;
    return new Date(Date.now() - opt.hours * 60 * 60 * 1000).toISOString();
  }, [rangeKey]);

  const { data: rawLogs = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-email-logs", sinceIso],
    queryFn: async () => {
      let q = supabase
        .from("email_send_log")
        .select("id, message_id, template_name, recipient_email, status, error_message, metadata, created_at")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (sinceIso) q = q.gte("created_at", sinceIso);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as EmailLog[];
    },
  });

  // Realtime — refresh on any insert
  useEffect(() => {
    const channel = supabase
      .channel("admin-email-logs-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "email_send_log" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["admin-email-logs"] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const dedupedLogs = useMemo(() => dedupeByMessageId(rawLogs), [rawLogs]);

  const templateOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of dedupedLogs) set.add(r.template_name);
    return Array.from(set).sort();
  }, [dedupedLogs]);

  const filteredLogs = useMemo(() => {
    return dedupedLogs.filter((r) => {
      if (templateFilter !== "all" && r.template_name !== templateFilter) return false;
      if (statusFilter !== "all") {
        if (statusFilter === "failed") {
          if (!["dlq", "failed", "bounced"].includes(r.status)) return false;
        } else if (r.status !== statusFilter) return false;
      }
      return true;
    });
  }, [dedupedLogs, templateFilter, statusFilter]);

  // Summary stats are computed on the deduplicated set within the active range
  const stats = useMemo(() => {
    const total = dedupedLogs.length;
    const sent = dedupedLogs.filter((r) => r.status === "sent").length;
    const failed = dedupedLogs.filter((r) =>
      ["dlq", "failed", "bounced"].includes(r.status)
    ).length;
    const suppressed = dedupedLogs.filter((r) => r.status === "suppressed").length;
    const pending = dedupedLogs.filter((r) => r.status === "pending").length;
    return { total, sent, failed, suppressed, pending };
  }, [dedupedLogs]);

  // Driver-application focused stats (agent's primary use case)
  const driverAppStats = useMemo(() => {
    const driverLogs = dedupedLogs.filter((r) =>
      r.template_name.startsWith("driver-application")
    );
    const sent = driverLogs.filter((r) => r.status === "sent").length;
    const failed = driverLogs.filter((r) =>
      ["dlq", "failed", "bounced"].includes(r.status)
    ).length;
    return { total: driverLogs.length, sent, failed };
  }, [dedupedLogs]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Mail className="h-6 w-6" /> Email Delivery Log
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track when transactional emails were sent and whether any failed.
            Includes driver application notifications.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-1" /> Refresh
        </Button>
      </div>

      {/* Driver application focus card */}
      <Card className="border-primary/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-muted-foreground">
            Driver application emails (within selected range)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-baseline gap-6">
            <div>
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-2xl font-bold">{driverAppStats.total}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-green-500" /> Sent
              </p>
              <p className="text-2xl font-bold text-green-600">{driverAppStats.sent}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <XCircle className="h-3 w-3 text-red-500" /> Failed
              </p>
              <p className="text-2xl font-bold text-red-600">{driverAppStats.failed}</p>
            </div>
            {driverAppStats.failed > 0 && (
              <div className="flex items-center gap-2 text-sm text-amber-600 ml-auto">
                <AlertTriangle className="h-4 w-4" />
                Review failed driver application emails below.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* All-template summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Total emails</CardTitle>
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{stats.total}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Sent</CardTitle>
          </CardHeader>
          <CardContent><p className="text-2xl font-bold text-green-600">{stats.sent}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Failed</CardTitle>
          </CardHeader>
          <CardContent><p className="text-2xl font-bold text-red-600">{stats.failed}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Suppressed</CardTitle>
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{stats.suppressed}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Pending</CardTitle>
          </CardHeader>
          <CardContent><p className="text-2xl font-bold text-yellow-600">{stats.pending}</p></CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={rangeKey} onValueChange={setRangeKey}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Time range" />
          </SelectTrigger>
          <SelectContent>
            {RANGE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={templateFilter} onValueChange={setTemplateFilter}>
          <SelectTrigger className="w-[260px]">
            <SelectValue placeholder="Template" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All templates</SelectItem>
            {templateOptions.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="suppressed">Suppressed</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
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
                <TableHead>Template</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="max-w-[280px]">Error</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No email events found for the selected filters.
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.slice(0, 200).map((log) => {
                  const isFailed = FAILED_STATUSES.includes(log.status);
                  const isDriverApp = log.template_name.startsWith(RESENDABLE_TEMPLATE_PREFIX);
                  const canResend = isFailed && isDriverApp;
                  const isResending = resendingId === log.id;
                  return (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{log.template_name}</Badge>
                      </TableCell>
                      <TableCell className="text-sm font-mono">{log.recipient_email}</TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${statusBadgeClass(log.status)}`}>
                          {log.status}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className="text-xs text-destructive max-w-[280px] truncate"
                        title={log.error_message || ""}
                      >
                        {log.error_message || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {canResend ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isResending}
                            onClick={() => setPendingResend(log)}
                          >
                            {isResending ? (
                              <>
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                Resending
                              </>
                            ) : (
                              <>
                                <Send className="h-3 w-3 mr-1" />
                                Resend
                              </>
                            )}
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          {filteredLogs.length > 200 && (
            <div className="text-xs text-muted-foreground text-center py-2 border-t">
              Showing latest 200 of {filteredLogs.length} entries — narrow filters to see more.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
