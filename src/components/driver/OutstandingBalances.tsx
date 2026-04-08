import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Banknote, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { fmt } from "@/lib/driver-constants";
import type { Ride } from "@/types/driver";

interface OutstandingBalancesProps {
  rides: Ride[];
}

export default function OutstandingBalances({ rides }: OutstandingBalancesProps) {
  const [showOutstanding, setShowOutstanding] = useState(false);
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const markOutstandingCollected = async (rideId: string) => {
    const { error } = await supabase
      .from("rides")
      .update({
        outstanding_amount_cents: 0,
        driver_collected_outstanding_at: new Date().toISOString(),
        payment_status: "paid",
        paid_at: new Date().toISOString(),
      })
      .eq("id", rideId);
    if (error) toast.error(error.message);
    else {
      toast.success(t("dispatch.markedCollected"));
      queryClient.invalidateQueries({ queryKey: ["outstanding-rides"] });
    }
  };

  if (!rides.length) return null;

  return (
    <div>
      <button
        onClick={() => setShowOutstanding(!showOutstanding)}
        className="flex w-full items-center justify-between rounded-2xl bg-amber-500/8 ring-1 ring-amber-500/20 px-4 py-3 text-left active:scale-[0.99] transition-transform"
      >
        <div className="flex items-center gap-3">
          <Banknote className="h-4 w-4 text-amber-500" />
          <div>
            <p className="text-sm font-semibold">Outstanding balances</p>
            <p className="text-xs text-muted-foreground">{rides.length} ride{rides.length > 1 ? "s" : ""} to collect</p>
          </div>
        </div>
        {showOutstanding ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      <AnimatePresence>
        {showOutstanding && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden space-y-2 mt-2">
            {rides.map((ride) => {
              const totalFare = Number(ride.final_fare_cents || ride.final_price || 0);
              const captured = Number(ride.captured_amount_cents || 0);
              const outstanding = Number(ride.outstanding_amount_cents || 0);
              const displayOutstanding = outstanding > 0 ? outstanding : totalFare;
              return (
                <div key={ride.id} className="rounded-2xl bg-card ring-1 ring-border/50 p-4 space-y-2">
                  <p className="text-sm font-medium truncate">{ride.pickup_address} → {ride.dropoff_address}</p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground tabular-nums">
                    <span>Total: {fmt(totalFare)}</span>
                    {captured > 0 && <span>Paid: {fmt(captured)}</span>}
                    <span className="text-amber-500 font-semibold">Due: {fmt(displayOutstanding)}</span>
                  </div>
                  <Button size="sm" className="w-full h-10 rounded-xl gap-1.5 active:scale-[0.98]" onClick={() => markOutstandingCollected(ride.id)}>
                    <Banknote className="h-3.5 w-3.5" /> Mark collected
                  </Button>
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
