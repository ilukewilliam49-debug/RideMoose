import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Car, ChevronRight, MapPin } from "lucide-react";
import { motion } from "framer-motion";

export default function ActiveRideBanner() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const { data: activeRide } = useQuery({
    queryKey: ["rider-active-ride-banner", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;
      const { data, error } = await supabase
        .from("rides")
        .select("id, status, pickup_address, dropoff_address, service_type, driver_id")
        .eq("rider_id", profile.id)
        .in("status", ["requested", "accepted", "in_progress"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) return null;
      return data;
    },
    enabled: !!profile?.id,
    refetchInterval: 10_000,
  });

  // Fetch driver name if assigned
  const { data: driverName } = useQuery({
    queryKey: ["banner-driver-name", activeRide?.driver_id],
    queryFn: async () => {
      if (!activeRide?.driver_id) return null;
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", activeRide.driver_id)
        .single();
      return data?.full_name ?? null;
    },
    enabled: !!activeRide?.driver_id,
  });

  if (!activeRide) return null;

  const statusLabel =
    activeRide.status === "requested"
      ? t("rider.lookingForDriver", "Looking for a driver…")
      : activeRide.status === "accepted"
      ? `${driverName ?? t("rider.driver")} ${t("rider.isOnTheWay", "is on the way")}`
      : t("rider.rideInProgress", "Ride in progress");

  return (
    <motion.button
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => navigate("/rider/rides")}
      className="flex w-full items-center gap-3 rounded-2xl bg-primary/10 border border-primary/20 p-4 text-left active:scale-[0.99] transition-transform"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/20">
        <Car className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-primary">{statusLabel}</p>
        <div className="flex items-center gap-1 mt-0.5">
          <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
          <p className="text-xs text-muted-foreground truncate">
            {activeRide.dropoff_address}
          </p>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-primary/60 shrink-0" />
    </motion.button>
  );
}
