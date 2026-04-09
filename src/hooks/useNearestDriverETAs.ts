import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDriverETAs } from "./useDriverETAs";

interface DriverRow {
  id: string;
  latitude: number | null;
  longitude: number | null;
  can_taxi: boolean;
  can_private_hire: boolean;
  can_courier: boolean;
}

/**
 * Returns the nearest driver ETA text for each service type (taxi, private_hire, courier).
 */
export function useNearestDriverETAs(userLocation: { lat: number; lng: number } | null) {
  const { data: drivers } = useQuery({
    queryKey: ["all-nearby-drivers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, latitude, longitude, can_taxi, can_private_hire, can_courier")
        .eq("role", "driver")
        .eq("is_available", true)
        .not("latitude", "is", null)
        .not("longitude", "is", null)
        .limit(50);
      if (error) throw error;
      return (data ?? []) as DriverRow[];
    },
    refetchInterval: 30000,
  });

  const driverCoords = useMemo(
    () =>
      (drivers ?? [])
        .filter((d) => d.latitude && d.longitude)
        .map((d) => ({ id: d.id, latitude: d.latitude!, longitude: d.longitude! })),
    [drivers]
  );

  const etas = useDriverETAs(driverCoords, userLocation);

  const perService = useMemo(() => {
    const result: Record<"taxi" | "private_hire" | "courier", string | null> = {
      taxi: null,
      private_hire: null,
      courier: null,
    };

    if (!drivers || drivers.length === 0) return result;

    const serviceFilters: Record<string, (d: DriverRow) => boolean> = {
      taxi: (d) => d.can_taxi,
      private_hire: (d) => d.can_private_hire,
      courier: (d) => d.can_courier,
    };

    for (const [svc, filter] of Object.entries(serviceFilters)) {
      let bestSec = Infinity;
      let bestText: string | null = null;

      for (const d of drivers) {
        if (!filter(d)) continue;
        const eta = etas[d.id];
        if (eta && eta.duration_sec < bestSec) {
          bestSec = eta.duration_sec;
          bestText = eta.duration_text;
        }
      }

      result[svc as keyof typeof result] = bestText;
    }

    return result;
  }, [drivers, etas]);

  return perService;
}
