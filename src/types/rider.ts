import type { Tables } from "@/integrations/supabase/types";

export type Ride = Tables<"rides">;
export type SavedPlace = Tables<"saved_places">;

export type ServiceType = "taxi" | "private_hire" | "courier" | "large_delivery" | "retail_delivery" | "personal_shopper" | "pet_transport";

export interface OrgMembership {
  organization_id: string;
  org_name: string;
  org_status: string;
  role: string;
  credit_limit_cents: number;
  current_balance_cents: number;
}

export interface DirectionsResult {
  distance_km: number;
  duration_sec: number;
  duration_text: string;
  duration_in_traffic_sec: number;
  duration_in_traffic_text: string;
  polyline: string | null;
}

export type RideStatusColor = Record<string, string>;

export const statusColors: RideStatusColor = {
  requested: "text-yellow-400",
  dispatched: "text-blue-400",
  accepted: "text-cyan-400",
  in_progress: "text-primary",
  completed: "text-green-400",
  cancelled: "text-muted-foreground",
};
