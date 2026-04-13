import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import {
  Circle, CheckCircle2, Play, Flag, XCircle,
  Send, Clock, UserCheck, MapPin,
} from "lucide-react";

const eventConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  requested: { icon: Send, color: "text-yellow-500", label: "Ride Requested" },
  dispatched: { icon: Clock, color: "text-blue-400", label: "Dispatched to Driver" },
  accepted: { icon: UserCheck, color: "text-blue-500", label: "Driver Accepted" },
  in_progress: { icon: Play, color: "text-emerald-500", label: "Ride Started" },
  completed: { icon: CheckCircle2, color: "text-green-500", label: "Ride Completed" },
  cancelled: { icon: XCircle, color: "text-destructive", label: "Ride Cancelled" },
};

const defaultEvent = { icon: Circle, color: "text-muted-foreground", label: "Event" };

interface RideEventsTimelineProps {
  rideId: string;
}

export default function RideEventsTimeline({ rideId }: RideEventsTimelineProps) {
  const { data: events, isLoading } = useQuery({
    queryKey: ["ride-events", rideId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ride_events")
        .select("id, event_type, actor_profile_id, metadata, created_at")
        .eq("ride_id", rideId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!rideId,
  });

  // Fetch actor names for display
  const actorIds = [...new Set((events || []).map((e) => e.actor_profile_id).filter(Boolean))];
  const { data: actors } = useQuery({
    queryKey: ["ride-event-actors", actorIds.join(",")],
    queryFn: async () => {
      if (actorIds.length === 0) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .in("id", actorIds);
      if (error) throw error;
      return data;
    },
    enabled: actorIds.length > 0,
  });

  const actorMap = new Map((actors || []).map((a) => [a.id, a]));

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">Event Timeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-8 w-8 rounded-full shrink-0" />
              <div className="space-y-1 flex-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!events || events.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">Event Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No events recorded for this ride.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Event Timeline
          <Badge variant="secondary" className="ml-2 text-xs">{events.length} events</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {events.map((event, index) => {
            const cfg = eventConfig[event.event_type] || { ...defaultEvent, label: event.event_type };
            const Icon = cfg.icon;
            const actor = event.actor_profile_id ? actorMap.get(event.actor_profile_id) : null;
            const meta = event.metadata as Record<string, unknown> | null;
            const isLast = index === events.length - 1;

            // Calculate duration from previous event
            let durationText: string | null = null;
            if (index > 0) {
              const prevTime = new Date(events[index - 1].created_at).getTime();
              const currTime = new Date(event.created_at).getTime();
              const diffMs = currTime - prevTime;
              if (diffMs < 60_000) {
                durationText = `+${Math.round(diffMs / 1000)}s`;
              } else if (diffMs < 3_600_000) {
                durationText = `+${Math.round(diffMs / 60_000)}m`;
              } else {
                durationText = `+${(diffMs / 3_600_000).toFixed(1)}h`;
              }
            }

            return (
              <div key={event.id} className="flex gap-3 relative">
                {/* Timeline line */}
                {!isLast && (
                  <div className="absolute left-4 top-9 w-px h-[calc(100%-12px)] bg-border" />
                )}

                {/* Icon */}
                <div className={`flex h-8 w-8 items-center justify-center rounded-full bg-card border shrink-0 z-10 ${cfg.color}`}>
                  <Icon className="h-4 w-4" />
                </div>

                {/* Content */}
                <div className={`flex-1 ${isLast ? "" : "pb-5"}`}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{cfg.label}</span>
                    {durationText && (
                      <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        {durationText}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground mt-0.5">
                    {format(new Date(event.created_at), "PPp")}
                  </p>

                  {/* Actor */}
                  {actor && (
                    <p className="text-xs text-muted-foreground mt-1">
                      By: <span className="font-medium text-foreground">{actor.full_name}</span>
                      <span className="ml-1 capitalize">({actor.role})</span>
                    </p>
                  )}

                  {/* Metadata */}
                  {meta && Object.keys(meta).length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {meta.previous_status && meta.new_status && (
                        <Badge variant="outline" className="text-xs font-normal">
                          {String(meta.previous_status)} → {String(meta.new_status)}
                        </Badge>
                      )}
                      {meta.service_type && (
                        <Badge variant="outline" className="text-xs font-normal capitalize">
                          {String(meta.service_type).replace(/_/g, " ")}
                        </Badge>
                      )}
                      {meta.pickup_address && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" />{String(meta.pickup_address).slice(0, 40)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
