import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceStrict } from "date-fns";
import {
  AlertTriangle,
  Clock,
  Power,
  PlayCircle,
  User,
  Phone,
  CheckCircle2,
  CircleDot,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type ShiftEventRow = {
  id: string;
  driver_id: string;
  event_type: "online" | "offline" | "auto_capped";
  shift_session_id: string | null;
  shift_started_at: string | null;
  shift_duration_minutes: number | null;
  source: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type DriverProfile = {
  full_name: string | null;
  phone: string | null;
  is_available: boolean | null;
  went_online_at: string | null;
};

interface Props {
  driverId: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function eventVisuals(type: string) {
  if (type === "auto_capped") {
    return {
      icon: AlertTriangle,
      label: "Auto-capped at 12h",
      color: "text-destructive",
      bg: "bg-destructive/10",
      ring: "ring-destructive/30",
      dot: "bg-destructive",
    };
  }
  if (type === "online") {
    return {
      icon: PlayCircle,
      label: "Went online",
      color: "text-emerald-600",
      bg: "bg-emerald-500/10",
      ring: "ring-emerald-500/30",
      dot: "bg-emerald-500",
    };
  }
  return {
    icon: Power,
    label: "Went offline",
    color: "text-muted-foreground",
    bg: "bg-muted",
    ring: "ring-border",
    dot: "bg-muted-foreground",
  };
}

function formatDuration(min: number | null) {
  if (min == null) return null;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

type SessionGroup = {
  key: string;
  sessionId: string | null;
  events: ShiftEventRow[];
  startEvent: ShiftEventRow | null;
  endEvent: ShiftEventRow | null;
  startedAt: Date | null;
  endedAt: Date | null;
  durationMin: number | null;
  capped: boolean;
  ongoing: boolean;
};

function groupBySession(events: ShiftEventRow[]): SessionGroup[] {
  const map = new Map<string, ShiftEventRow[]>();
  let orphanCounter = 0;
  for (const ev of events) {
    const key = ev.shift_session_id ?? `__orphan_${orphanCounter++}_${ev.id}`;
    const arr = map.get(key) ?? [];
    arr.push(ev);
    map.set(key, arr);
  }

  const groups: SessionGroup[] = [];
  for (const [key, evs] of map) {
    const asc = [...evs].sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    const startEvent = asc.find((e) => e.event_type === "online") ?? null;
    const endEvent =
      [...asc]
        .reverse()
        .find(
          (e) => e.event_type === "offline" || e.event_type === "auto_capped"
        ) ?? null;
    const startedAt =
      (startEvent?.shift_started_at
        ? new Date(startEvent.shift_started_at)
        : null) ??
      (startEvent ? new Date(startEvent.created_at) : null);
    const endedAt = endEvent ? new Date(endEvent.created_at) : null;
    const durationMin =
      endEvent?.shift_duration_minutes ??
      (startedAt && endedAt
        ? Math.max(
            0,
            Math.round((endedAt.getTime() - startedAt.getTime()) / 60_000)
          )
        : null);
    const capped = asc.some((e) => e.event_type === "auto_capped");
    const ongoing = !endEvent && !!startEvent;

    groups.push({
      key,
      sessionId: evs[0].shift_session_id,
      events: asc,
      startEvent,
      endEvent,
      startedAt,
      endedAt,
      durationMin,
      capped,
      ongoing,
    });
  }

  groups.sort((a, b) => {
    const at = a.startedAt?.getTime() ?? 0;
    const bt = b.startedAt?.getTime() ?? 0;
    return bt - at;
  });
  return groups;
}

export function DriverShiftDetailDrawer({
  driverId,
  driverName,
  driverPhone,
  open,
  onOpenChange,
}: Props) {
  const { data: profile } = useQuery({
    queryKey: ["driver-shift-profile", driverId],
    enabled: !!driverId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, phone, is_available, went_online_at")
        .eq("id", driverId!)
        .maybeSingle();
      if (error) throw error;
      return data as DriverProfile | null;
    },
  });

  const { data: events, isLoading } = useQuery({
    queryKey: ["driver-shift-events-timeline", driverId],
    enabled: !!driverId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("driver_shift_events" as any)
        .select("*")
        .eq("driver_id", driverId!)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as ShiftEventRow[];
    },
  });

  const summary = (() => {
    if (!events) return null;
    const online = events.filter((e) => e.event_type === "online").length;
    const offline = events.filter((e) => e.event_type === "offline").length;
    const capped = events.filter((e) => e.event_type === "auto_capped").length;
    return { online, offline, capped, total: events.length };
  })();

  const sessions = events ? groupBySession(events) : [];

  const displayName = profile?.full_name || driverName || "Unknown driver";
  const displayPhone = profile?.phone || driverPhone || null;
  const isCurrentlyOnline = profile?.is_available === true;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg p-0 flex flex-col"
      >
        <SheetHeader className="p-6 pb-4 border-b shrink-0">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle className="truncate text-left">
                {displayName}
              </SheetTitle>
              <SheetDescription asChild>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  {displayPhone && (
                    <span className="inline-flex items-center gap-1 text-xs">
                      <Phone className="h-3 w-3" />
                      {displayPhone}
                    </span>
                  )}
                  <Badge
                    variant={isCurrentlyOnline ? "default" : "secondary"}
                    className={cn(
                      "text-xs",
                      isCurrentlyOnline &&
                        "bg-emerald-500/15 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20"
                    )}
                  >
                    {isCurrentlyOnline ? "Online now" : "Offline"}
                  </Badge>
                </div>
              </SheetDescription>
            </div>
          </div>

          {summary && summary.total > 0 && (
            <div className="grid grid-cols-3 gap-2 pt-4">
              <div className="rounded-md border bg-card p-2 text-center">
                <p className="text-[10px] uppercase text-muted-foreground tracking-wide">
                  Online
                </p>
                <p className="text-lg font-semibold text-emerald-600">
                  {summary.online}
                </p>
              </div>
              <div className="rounded-md border bg-card p-2 text-center">
                <p className="text-[10px] uppercase text-muted-foreground tracking-wide">
                  Offline
                </p>
                <p className="text-lg font-semibold">{summary.offline}</p>
              </div>
              <div className="rounded-md border bg-destructive/10 p-2 text-center">
                <p className="text-[10px] uppercase text-destructive tracking-wide">
                  Auto-cap
                </p>
                <p className="text-lg font-semibold text-destructive">
                  {summary.capped}
                </p>
              </div>
            </div>
          )}
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-medium">Shift sessions</h3>
              {sessions.length > 0 && (
                <Badge variant="outline" className="text-xs ml-auto">
                  {sessions.length}{" "}
                  {sessions.length === 1 ? "session" : "sessions"}
                </Badge>
              )}
            </div>

            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-32 w-full" />
                ))}
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                No shift sessions recorded for this driver yet.
              </div>
            ) : (
              <div className="space-y-5">
                {sessions.map((session) => {
                  const StatusIcon = session.capped
                    ? AlertTriangle
                    : session.ongoing
                    ? CircleDot
                    : CheckCircle2;
                  const statusColor = session.capped
                    ? "text-destructive"
                    : session.ongoing
                    ? "text-emerald-600"
                    : "text-muted-foreground";
                  const statusLabel = session.capped
                    ? "Capped at 12h"
                    : session.ongoing
                    ? "In progress"
                    : "Completed";
                  const cardRing = session.capped
                    ? "ring-destructive/30 bg-destructive/5"
                    : session.ongoing
                    ? "ring-emerald-500/30 bg-emerald-500/5"
                    : "ring-border bg-card";

                  return (
                    <div
                      key={session.key}
                      className={cn(
                        "rounded-lg border ring-1 overflow-hidden",
                        cardRing
                      )}
                    >
                      {/* Session header */}
                      <div className="p-3 border-b border-border/50 bg-background/50">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <StatusIcon
                              className={cn("h-4 w-4", statusColor)}
                            />
                            <span
                              className={cn("text-sm font-semibold", statusColor)}
                            >
                              {statusLabel}
                            </span>
                          </div>
                          {session.sessionId && (
                            <span className="text-[10px] text-muted-foreground/70 font-mono">
                              #{session.sessionId.slice(0, 8)}
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                          <div>
                            <p className="text-[10px] uppercase text-muted-foreground tracking-wide">
                              Start
                            </p>
                            <p className="font-medium mt-0.5">
                              {session.startedAt
                                ? format(session.startedAt, "MMM d, p")
                                : "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase text-muted-foreground tracking-wide">
                              End
                            </p>
                            <p className="font-medium mt-0.5">
                              {session.endedAt
                                ? format(session.endedAt, "MMM d, p")
                                : session.ongoing
                                ? "Ongoing"
                                : "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase text-muted-foreground tracking-wide">
                              Duration
                            </p>
                            <p
                              className={cn(
                                "font-semibold mt-0.5",
                                session.capped && "text-destructive"
                              )}
                            >
                              {formatDuration(session.durationMin) ?? "—"}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Session events */}
                      <ol className="relative border-l-2 border-border/60 ml-5 my-3 mr-3 space-y-3 py-1">
                        {session.events.map((ev) => {
                          const v = eventVisuals(ev.event_type);
                          const Icon = v.icon;
                          const meta = (ev.metadata ?? {}) as Record<
                            string,
                            unknown
                          >;
                          const note =
                            ev.event_type === "auto_capped"
                              ? `Mandatory rest period — ${
                                  meta.reason ?? "12h HOS cap"
                                }`
                              : typeof meta.note === "string"
                              ? meta.note
                              : null;
                          return (
                            <li key={ev.id} className="ml-4">
                              <span
                                className={cn(
                                  "absolute -left-[7px] flex h-3 w-3 rounded-full ring-2 ring-background",
                                  v.dot
                                )}
                              />
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-1.5">
                                  <Icon className={cn("h-3.5 w-3.5", v.color)} />
                                  <span
                                    className={cn(
                                      "text-xs font-medium",
                                      v.color
                                    )}
                                  >
                                    {v.label}
                                  </span>
                                </div>
                                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                  {format(new Date(ev.created_at), "p")}
                                </span>
                              </div>
                              <div className="text-[10px] text-muted-foreground mt-0.5">
                                {format(new Date(ev.created_at), "PP")} · via{" "}
                                {ev.source.replace(/_/g, " ")}
                              </div>
                              {note && (
                                <p className="mt-1 text-[11px] text-foreground/80">
                                  {note}
                                </p>
                              )}
                            </li>
                          );
                        })}
                      </ol>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </ScrollArea>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
