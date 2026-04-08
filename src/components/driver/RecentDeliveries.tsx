import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Receipt, ChevronDown, ChevronUp } from "lucide-react";
import ServiceIcon from "@/components/driver/ServiceIcon";
import { fmt } from "@/lib/driver-constants";
import type { Ride } from "@/types/driver";

interface RecentDeliveriesProps {
  rides: Ride[];
}

export default function RecentDeliveries({ rides }: RecentDeliveriesProps) {
  const [showHistory, setShowHistory] = useState(false);

  if (!rides.length) return null;

  return (
    <div>
      <button
        onClick={() => setShowHistory(!showHistory)}
        className="flex w-full items-center justify-between rounded-2xl bg-card ring-1 ring-border/50 px-4 py-3 text-left active:scale-[0.99] transition-transform"
      >
        <div className="flex items-center gap-3">
          <Receipt className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold">Recent deliveries</p>
        </div>
        {showHistory ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      <AnimatePresence>
        {showHistory && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden space-y-2 mt-2">
            {rides.map((ride) => (
              <div key={ride.id} className="rounded-2xl bg-card ring-1 ring-border/50 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <ServiceIcon type={ride.service_type} className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <p className="text-sm font-medium truncate">{ride.pickup_address} → {ride.dropoff_address}</p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0 ml-2">
                    {ride.completed_at ? new Date(ride.completed_at).toLocaleDateString() : ""}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs tabular-nums">
                  <span className="text-muted-foreground">Fare: {fmt(ride.final_fare_cents || 0)}</span>
                  <span className="text-primary font-semibold">Net: {fmt(ride.driver_earnings_cents || 0)}</span>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
