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
              <h3 className="text-sm font-medium">Activity timeline</h3>
              {events && (
                <Badge variant="outline" className="text-xs ml-auto">
                  {events.length} {events.length === 1 ? "event" : "events"}
                </Badge>
              )}
            </div>

            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : !events || events.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                No shift events recorded for this driver yet.
              </div>
            ) : (
              <ol className="relative border-l-2 border-border ml-3 space-y-4">
                {events.map((ev) => {
                  const v = eventVisuals(ev.event_type);
                  const Icon = v.icon;
                  const meta = (ev.metadata ?? {}) as Record<string, unknown>;
                  const duration = formatDuration(ev.shift_duration_minutes);
                  const note =
                    ev.event_type === "auto_capped"
                      ? `Mandatory rest period — ${
                          meta.reason ?? "12h HOS cap"
                        }`
                      : typeof meta.note === "string"
                      ? meta.note
                      : null;
                  return (
                    <li key={ev.id} className="ml-6">
                      <span
                        className={cn(
                          "absolute -left-[9px] flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-background",
                          v.dot
                        )}
                      />
                      <div
                        className={cn(
                          "rounded-lg border p-3 ring-1",
                          v.bg,
                          v.ring
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Icon className={cn("h-4 w-4", v.color)} />
                            <span
                              className={cn("text-sm font-medium", v.color)}
                            >
                              {v.label}
                            </span>
                          </div>
                          <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                            {formatDistanceStrict(
                              new Date(ev.created_at),
                              new Date(),
                              { addSuffix: true }
                            )}
                          </span>
                        </div>

                        <div className="mt-1 text-xs text-muted-foreground">
                          {format(new Date(ev.created_at), "PPpp")}
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                          <span className="capitalize text-muted-foreground">
                            via {ev.source.replace(/_/g, " ")}
                          </span>
                          {duration && (
                            <span
                              className={cn(
                                "font-medium",
                                ev.event_type === "auto_capped"
                                  ? "text-destructive"
                                  : "text-foreground"
                              )}
                            >
                              Shift: {duration}
                            </span>
                          )}
                          {ev.shift_session_id && (
                            <span className="text-muted-foreground/70 font-mono text-[10px]">
                              #{ev.shift_session_id.slice(0, 8)}
                            </span>
                          )}
                        </div>

                        {note && (
                          <p className="mt-2 text-xs text-foreground/80 border-t border-border/50 pt-2">
                            {note}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
