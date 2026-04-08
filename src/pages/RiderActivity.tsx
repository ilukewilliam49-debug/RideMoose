import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { Car, MapPin, Clock, Filter } from "lucide-react";
import { format } from "date-fns";
import { statusColors, type Ride } from "@/types/rider";
import ErrorRetry from "@/components/driver/ErrorRetry";
import RideDetailSheet from "@/components/rider/RideDetailSheet";

type StatusFilter = "all" | "completed" | "cancelled" | "active";

const RiderActivity = () => {
  const { profile } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const { data: rides, isLoading, isError, refetch } = useQuery({
    queryKey: ["rider-activity", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data, error } = await supabase
        .from("rides")
        .select("*")
        .eq("rider_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as Ride[];
    },
    enabled: !!profile?.id,
  });

  // Realtime subscription
  useEffect(() => {
    if (!profile?.id) return;
    const channel = supabase
      .channel("rider-activity-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "rides" }, () => {
        queryClient.invalidateQueries({ queryKey: ["rider-activity"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.id, queryClient]);

  const filteredRides = rides?.filter((ride) => {
    if (filter === "all") return true;
    if (filter === "completed") return ride.status === "completed";
    if (filter === "cancelled") return ride.status === "cancelled";
    if (filter === "active") return ["requested", "accepted", "in_progress"].includes(ride.status);
    return true;
  });

  const filters: { key: StatusFilter; label: string }[] = [
    { key: "all", label: t("activity.all", "All") },
    { key: "active", label: t("activity.active", "Active") },
    { key: "completed", label: t("activity.completed", "Completed") },
    { key: "cancelled", label: t("activity.cancelled", "Cancelled") },
  ];

  return (
    <div className="space-y-5 pb-24">
      <h1 className="text-xl font-black tracking-tight">{t("bottomNav.activity")}</h1>

      {/* Filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              filter === f.key
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:bg-accent"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-2xl bg-card/50 animate-pulse" />
          ))}
        </div>
      )}

      {isError && (
        <ErrorRetry message="Failed to load ride history" onRetry={() => refetch()} />
      )}

      {!isLoading && !isError && filteredRides && filteredRides.length === 0 && (
        <div className="text-center py-12">
          <Car className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">{t("activity.noRides")}</p>
        </div>
      )}

      {filteredRides && filteredRides.length > 0 && (
        <div className="space-y-2">
          {filteredRides.map((ride) => (
            <button
              key={ride.id}
              onClick={() => {
                setSelectedRide(ride);
                setDetailOpen(true);
              }}
              className="w-full text-left rounded-2xl bg-card/50 p-4 space-y-2 hover:bg-card/70 transition-colors active:scale-[0.99]"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Car className="h-4 w-4 text-primary/70" />
                  <span className="text-[13px] font-semibold capitalize">
                    {ride.service_type?.replace("_", " ")}
                  </span>
                </div>
                <span className={`text-[11px] font-bold uppercase tracking-wider ${statusColors[ride.status] || ""}`}>
                  {ride.status}
                </span>
              </div>
              <div className="space-y-1">
                <div className="flex items-start gap-2">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground/50 mt-0.5 shrink-0" />
                  <p className="text-[13px] text-muted-foreground truncate">{ride.pickup_address}</p>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="h-3.5 w-3.5 text-primary/50 mt-0.5 shrink-0" />
                  <p className="text-[13px] text-muted-foreground truncate">{ride.dropoff_address}</p>
                </div>
              </div>
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
                  <Clock className="h-3 w-3" />
                  {format(new Date(ride.created_at), "MMM d, h:mm a")}
                </div>
                {ride.final_fare_cents != null && (
                  <span className="text-sm font-bold font-mono">
                    ${(ride.final_fare_cents / 100).toFixed(2)}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Trip detail sheet */}
      <RideDetailSheet
        ride={selectedRide}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  );
};

export default RiderActivity;
