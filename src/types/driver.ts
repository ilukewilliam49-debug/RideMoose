import type { Tables } from "@/integrations/supabase/types";

// Core ride type from database
export type Ride = Tables<"rides">;

// Profile type from database
export type Profile = Tables<"profiles">;

// Delivery bid type
export type DeliveryBid = Tables<"delivery_bids">;

// Rider profile subset for active trip context
export interface RiderProfileSummary {
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
}

// Dashboard stats
export interface DashboardStats {
  activeRide: Pick<Ride, "id" | "status" | "pickup_address" | "dropoff_address" | "service_type" | "created_at"> | null;
  pendingCount: number;
  completedToday: number;
  earningsToday: number;
  outstandingTotal: number;
}

// Rating data
export interface RatingData {
  average: number;
  count: number;
}

// Earnings stats
export interface EarningsStats {
  totalEarnings: number;
  totalCommission: number;
  totalStripeFees: number;
  totalGross: number;
  tripCount: number;
  recentTrips: Ride[];
}

// Chart data point
export interface ChartDataPoint {
  day: string;
  earnings: number;
  isToday: boolean;
}

// Shift stats
export interface ShiftStats {
  totalSessions: number;
  totalHours: number;
}

// Directions data
export interface DirectionsData {
  polyline: string | null;
  distance_km: number;
  duration_text: string;
  duration_in_traffic_text: string;
  duration_in_traffic_sec: number;
  duration_sec: number;
}

// Live ETA data  
export interface LiveEtaData extends DirectionsData {
  steps?: Array<{ instruction: string; distance: string; duration: string }>;
}
