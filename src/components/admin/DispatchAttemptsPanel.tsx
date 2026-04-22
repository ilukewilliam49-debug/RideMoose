import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CheckCircle2, XCircle, Clock, Bell, Trophy, Download } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// Viewer's IANA timezone, resolved once at module load.
// Used for both on-screen displays AND the CSV export so the two match exactly.
const VIEWER_TZ =
  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

// e.g. "Apr 22, 2026, 3:14:09 PM MDT"
const tsFormatter = new Intl.DateTimeFormat(undefined, {
  timeZone: VIEWER_TZ,
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
  timeZoneName: "short",
});

// Short label used in the header chip, e.g. "MDT" or "GMT-6"
const tzAbbrev = (() => {
  const parts = new Intl.DateTimeFormat(undefined, {
    timeZone: VIEWER_TZ,
    timeZoneName: "short",
  }).formatToParts(new Date());
  return parts.find((p) => p.type === "timeZoneName")?.value ?? VIEWER_TZ;
})();

const formatTs = (iso: string) => tsFormatter.format(new Date(iso));

interface DispatchLog {
  id: string;
  event: string;
  method: string;
  status: string;
  target_profile_id: string | null;
  recipients: number;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  completed_at: string | null;
}

interface DriverInfo {
  id: string;
  full_name: string | null;
}

interface DispatchAttempt {
  hop: number;
  driverId: string | null;
  attemptLog?: DispatchLog;
  outcomeLog?: DispatchLog;
}

interface Props {
  rideId: string;
}

export default function DispatchAttemptsPanel({ rideId }: Props) {
  const queryClient = useQueryClient();

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["dispatch-logs", rideId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification_logs")
        .select(
          "id, event, method, status, target_profile_id, recipients, error_message, metadata, created_at, completed_at",
        )
        .eq("ride_id", rideId)
        .in("event", ["dispatch.attempt", "dispatch.outcome", "dispatch.resolved"])
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as DispatchLog[];
    },
  });

  // Fetch the ride's rider_id so audit CSV rows are self-contained.
  const { data: rideMeta } = useQuery({
    queryKey: ["dispatch-logs-ride-meta", rideId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rides")
        .select("id, rider_id")
        .eq("id", rideId)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; rider_id: string } | null;
    },
  });

  // Realtime: refresh as the dispatch unfolds.
  useEffect(() => {
    const channel = supabase
      .channel(`dispatch-logs-${rideId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notification_logs", filter: `ride_id=eq.${rideId}` },
        () => queryClient.invalidateQueries({ queryKey: ["dispatch-logs", rideId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [rideId, queryClient]);

  // Resolve driver names referenced by these logs.
  const driverIds = useMemo(() => {
    const ids = new Set<string>();
    for (const l of logs) if (l.target_profile_id) ids.add(l.target_profile_id);
    return Array.from(ids);
  }, [logs]);

  const { data: drivers = [] } = useQuery({
    queryKey: ["dispatch-log-drivers", driverIds.sort().join(",")],
    enabled: driverIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", driverIds);
      if (error) throw error;
      return (data || []) as DriverInfo[];
    },
  });
  const driverMap = useMemo(
    () => new Map(drivers.map((d) => [d.id, d.full_name || "Unnamed driver"])),
    [drivers],
  );

  // Group logs into per-hop attempts + a resolution row.
  const { attempts, resolution } = useMemo(() => {
    const attempts: DispatchAttempt[] = [];
    let resolution: DispatchLog | undefined;
    const byHop = new Map<number, DispatchAttempt>();

    for (const log of logs) {
      if (log.event === "dispatch.resolved") {
        resolution = log;
        continue;
      }
      const meta = (log.metadata || {}) as Record<string, unknown>;
      const hop = typeof meta.hop === "number" ? meta.hop : 0;
      let bucket = byHop.get(hop);
      if (!bucket) {
        bucket = { hop, driverId: log.target_profile_id, attemptLog: undefined, outcomeLog: undefined };
        byHop.set(hop, bucket);
        attempts.push(bucket);
      }
      if (log.event === "dispatch.attempt") bucket.attemptLog = log;
      if (log.event === "dispatch.outcome") bucket.outcomeLog = log;
    }
    attempts.sort((a, b) => a.hop - b.hop);
    return { attempts, resolution };
  }, [logs]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Bell className="h-4 w-4" /> Dispatch Attempts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  const handleExportCsv = () => {
    const headers = [
      "ride_id",
      "rider_id",
      "dispatch_log_id",
      "timestamp_iso",
      "timestamp_local",
      "timezone",
      "event",
      "hop",
      "status",
      "outcome",
      "driver_id",
      "driver_name",
      "distance_km",
      "response_latency_ms",
      "recipients",
      "error_message",
    ];
    const riderId = rideMeta?.rider_id ?? "";
    const rows = logs.map((log) => {
      const meta = (log.metadata || {}) as Record<string, unknown>;
      const driverName = log.target_profile_id
        ? driverMap.get(log.target_profile_id) ?? (meta.driver_name as string) ?? ""
        : "";
      return [
        rideId,
        riderId,
        log.id,
        log.created_at, // canonical UTC ISO
        formatTs(log.created_at), // matches on-screen display exactly
        VIEWER_TZ,
        log.event,
        meta.hop ?? "",
        log.status,
        meta.outcome ?? "",
        log.target_profile_id ?? "",
        driverName,
        meta.distance_km ?? "",
        meta.response_latency_ms ?? "",
        log.recipients ?? "",
        log.error_message ?? "",
      ];
    });
    const escape = (v: unknown) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [headers.join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    // Filename uses a filesystem-safe local timestamp (no colons/spaces).
    const stamp = formatTs(new Date().toISOString())
      .replace(/[\s,:]+/g, "-")
      .replace(/[^\w.-]/g, "");
    a.download = `dispatch-timeline-${rideId}-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Bell className="h-4 w-4" /> Dispatch Attempts
            {attempts.length > 0 && (
              <Badge variant="outline" className="ml-1 text-xs">
                {attempts.length} hop{attempts.length === 1 ? "" : "s"}
              </Badge>
            )}
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={logs.length === 0}
            className="h-8 gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {attempts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No dispatch attempts recorded yet.</p>
        ) : (
          <ol className="space-y-2">
            {attempts.map((a) => {
              const meta = (a.attemptLog?.metadata || {}) as Record<string, unknown>;
              const outcomeMeta = (a.outcomeLog?.metadata || {}) as Record<string, unknown>;
              const outcome = (outcomeMeta.outcome as string) ?? "pending";
              const distance = typeof meta.distance_km === "number" ? meta.distance_km : null;
              const latencyMs =
                typeof outcomeMeta.response_latency_ms === "number"
                  ? outcomeMeta.response_latency_ms
                  : null;
              const driverName = a.driverId
                ? driverMap.get(a.driverId) ?? (meta.driver_name as string) ?? "Unknown driver"
                : "—";
              const pushFailed = a.attemptLog?.status === "failed";

              return (
                <li
                  key={a.hop}
                  className="flex items-start gap-3 rounded-lg border p-3 bg-card"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                    #{a.hop}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {a.driverId ? (
                        <Link
                          to={`/admin/users/${a.driverId}`}
                          className="text-sm font-medium text-primary hover:underline truncate"
                        >
                          {driverName}
                        </Link>
                      ) : (
                        <span className="text-sm font-medium">{driverName}</span>
                      )}
                      {distance !== null && (
                        <Badge variant="outline" className="text-xs">
                          {distance.toFixed(2)} km
                        </Badge>
                      )}
                      <OutcomeBadge outcome={outcome} pushFailed={pushFailed} />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Notified{" "}
                      {a.attemptLog
                        ? `${formatDistanceToNow(new Date(a.attemptLog.created_at), { addSuffix: true })} · ${format(
                            new Date(a.attemptLog.created_at),
                            "PPpp",
                          )}`
                        : "—"}
                    </div>
                    {pushFailed && a.attemptLog?.error_message && (
                      <p className="text-xs text-destructive">
                        Push error: {a.attemptLog.error_message}
                      </p>
                    )}
                    {latencyMs !== null && (
                      <p className="text-xs text-muted-foreground">
                        Driver responded after {Math.round(latencyMs / 100) / 10}s
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        {resolution && <ResolutionRow log={resolution} driverMap={driverMap} />}
      </CardContent>
    </Card>
  );
}

function OutcomeBadge({ outcome, pushFailed }: { outcome: string; pushFailed: boolean }) {
  if (pushFailed && outcome === "pending") {
    return (
      <Badge className="text-xs bg-destructive/10 text-destructive border-destructive/30">
        <XCircle className="h-3 w-3 mr-1" /> Push failed
      </Badge>
    );
  }
  switch (outcome) {
    case "accepted":
      return (
        <Badge className="text-xs bg-primary/10 text-primary border-primary/30">
          <CheckCircle2 className="h-3 w-3 mr-1" /> Accepted
        </Badge>
      );
    case "timeout_or_decline":
      return (
        <Badge className="text-xs bg-accent/10 text-accent border-accent/30">
          <Clock className="h-3 w-3 mr-1" /> Declined / timed out
        </Badge>
      );
    case "ride_cancelled":
      return (
        <Badge variant="outline" className="text-xs">
          Ride cancelled
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-xs">
          Awaiting response…
        </Badge>
      );
  }
}

function ResolutionRow({
  log,
  driverMap,
}: {
  log: DispatchLog;
  driverMap: Map<string, string>;
}) {
  const meta = (log.metadata || {}) as Record<string, unknown>;
  const outcome = (meta.outcome as string) ?? "unknown";
  const matched = outcome === "matched";
  const winnerName = log.target_profile_id ? driverMap.get(log.target_profile_id) : null;

  return (
    <div
      className={`flex items-start gap-3 rounded-lg border p-3 ${
        matched
          ? "bg-primary/5 border-primary/30"
          : "bg-destructive/5 border-destructive/30"
      }`}
    >
      <Trophy
        className={`h-5 w-5 shrink-0 mt-0.5 ${
          matched ? "text-primary" : "text-destructive"
        }`}
      />
      <div className="flex-1 text-sm">
        <p className="font-medium">
          {matched
            ? `Matched: ${winnerName || "driver"} accepted`
            : "No driver accepted — ride returned to queue"}
        </p>
        <p className="text-xs text-muted-foreground">
          {typeof meta.hops_attempted === "number" && (
            <>
              {meta.hops_attempted as number} hop
              {(meta.hops_attempted as number) === 1 ? "" : "s"} ·{" "}
            </>
          )}
          Resolved {format(new Date(log.created_at), "PPpp")}
        </p>
      </div>
    </div>
  );
}
