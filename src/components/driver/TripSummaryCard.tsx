import { motion } from "framer-motion";
import { X, Clock, Route, DollarSign, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { serviceLabels, fmt } from "@/lib/driver-constants";

interface TripSummaryCardProps {
  ride: {
    id: string;
    service_type: string;
    pickup_address: string;
    dropoff_address: string;
    distance_km?: number | null;
    duration_min?: number;
    final_price?: number | null;
    final_fare_cents?: number | null;
    driver_earnings_cents?: number;
    commission_cents?: number;
    tip_cents?: number;
    payment_option?: string;
    completed_at?: string | null;
  };
  onDismiss: () => void;
}

export default function TripSummaryCard({ ride, onDismiss }: TripSummaryCardProps) {
  const fareCents = ride.final_fare_cents ?? Math.round((ride.final_price ?? 0) * 100);
  const tipCents = (ride as any).tip_cents ?? 0;
  const earnings = (ride.driver_earnings_cents ?? 0) + tipCents;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="rounded-2xl bg-card ring-1 ring-border/50 overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-green-500/10">
            <Star className="h-4 w-4 text-green-500" />
          </div>
          <span className="text-sm font-bold">Trip Complete</span>
        </div>
        <button onClick={onDismiss} className="p-1 rounded-lg hover:bg-secondary transition-colors">
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      <div className="px-4 pb-3 space-y-3">
        {/* Route */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p className="truncate">📍 {ride.pickup_address}</p>
          <p className="truncate">🏁 {ride.dropoff_address}</p>
        </div>

        {/* Stats row */}
        <div className="flex gap-4">
          {ride.distance_km && (
            <div className="flex items-center gap-1.5 text-xs">
              <Route className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium">{Number(ride.distance_km).toFixed(1)} km</span>
            </div>
          )}
          {ride.duration_min ? (
            <div className="flex items-center gap-1.5 text-xs">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium">{Math.round(ride.duration_min)} min</span>
            </div>
          ) : null}
          <div className="flex items-center gap-1.5 text-xs">
            <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-medium">{serviceLabels[ride.service_type] || ride.service_type}</span>
          </div>
        </div>

        {/* Earnings breakdown */}
        <div className="rounded-xl bg-secondary/50 p-3 space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Fare</span>
            <span className="font-medium">{fmt(fareCents)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Commission</span>
            <span className="font-medium text-destructive">-{fmt(ride.commission_cents ?? 0)}</span>
          </div>
          {tipCents > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Tip</span>
              <span className="font-medium text-green-500">+{fmt(tipCents)}</span>
            </div>
          )}
          <div className="h-px bg-border/50 my-1" />
          <div className="flex justify-between text-sm font-bold">
            <span>Your Earnings</span>
            <span className="text-green-500">{fmt(earnings)}</span>
          </div>
        </div>

        <Button variant="outline" className="w-full rounded-xl" onClick={onDismiss}>
          Done
        </Button>
      </div>
    </motion.div>
  );
}
