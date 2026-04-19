import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "./useAuth";

const ACTIVE_STATUSES = ["accepted", "arrived", "in_progress"] as const satisfies readonly ("accepted" | "arrived" | "in_progress")[];

/**
 * Returns true if the given profile (rider or driver) is currently in an
 * active ride (accepted / arrived / in_progress). Subscribes to realtime
 * changes so the value flips immediately when the ride starts/ends.
 */
export const useHasActiveRide = (profile: Profile | null): boolean => {
  const queryClient = useQueryClient();
  const profileId = profile?.id;
  const role: "driver" | "rider" = profile?.is_driver ? "driver" : "rider";

  const { data } = useQuery({
    queryKey: ["has-active-ride", profileId, role],
    queryFn: async () => {
      if (!profileId) return false;
      const column = role === "driver" ? "driver_id" : "rider_id";
      const { data, error } = await supabase
        .from("rides")
        .select("id")
        .eq(column, profileId)
        .in("status", ACTIVE_STATUSES)
        .limit(1);
      if (error) return false;
      return (data?.length ?? 0) > 0;
    },
    enabled: !!profileId,
    staleTime: 15_000,
    refetchInterval: 60_000,
  });

  useEffect(() => {
    if (!profileId) return;
    const column = role === "driver" ? "driver_id" : "rider_id";
    const channel = supabase
      .channel(`active-ride-${role}-${profileId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "rides",
          filter: `${column}=eq.${profileId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["has-active-ride", profileId, role] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profileId, role, queryClient]);

  return !!data;
};
