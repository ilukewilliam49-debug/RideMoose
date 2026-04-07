import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { Car, MapPin, Clock } from "lucide-react";
import { format } from "date-fns";

const RiderActivity = () => {
  const { profile } = useAuth();
  const { t } = useTranslation();

  const { data: rides, isLoading } = useQuery({
    queryKey: ["rider-activity", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data, error } = await supabase
        .from("rides")
        .select("id, pickup_address, dropoff_address, status, created_at, final_fare_cents, service_type")
        .eq("rider_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!profile?.id,
  });

  return (
    <div className="space-y-5 pb-24">
      <h1 className="text-xl font-black tracking-tight">{t("bottomNav.activity")}</h1>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-2xl bg-card/50 animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && rides && rides.length === 0 && (
        <div className="text-center py-12">
          <Car className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">{t("activity.noRides")}</p>
        </div>
      )}

      {rides && rides.length > 0 && (
        <div className="space-y-2">
          {rides.map((ride) => (
            <div
              key={ride.id}
              className="rounded-2xl bg-card/50 p-4 space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Car className="h-4 w-4 text-primary/70" />
                  <span className="text-[13px] font-semibold capitalize">
                    {ride.service_type?.replace("_", " ")}
                  </span>
                </div>
                <span className={`text-[11px] font-bold uppercase tracking-wider ${
                  ride.status === "completed" ? "text-green-500" :
                  ride.status === "cancelled" ? "text-destructive" :
                  "text-primary"
                }`}>
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RiderActivity;
