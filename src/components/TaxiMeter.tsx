import { Button } from "@/components/ui/button";
import { useTaxiMeter, type FareReceipt } from "@/hooks/useTaxiMeter";
import { Play, Square, Clock, MapPin as RouteIcon, DollarSign, Pause } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

function formatTime(min: number) {
  const m = Math.floor(min);
  const s = Math.floor((min - m) * 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function cents(v: number) {
  return `$${(v / 100).toFixed(2)}`;
}

function ReceiptBreakdown({ receipt }: { receipt: FareReceipt }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-2 mt-4 p-4 rounded-lg bg-secondary/50 border border-border">
      <h3 className="text-sm font-semibold text-primary">Fare Breakdown</h3>
      <div className="grid grid-cols-2 gap-1 text-xs">
        <span className="text-muted-foreground">Base fare</span>
        <span className="text-right font-mono">{cents(receipt.baseFare)}</span>
        <span className="text-muted-foreground">Distance ({receipt.distanceKm.toFixed(2)} km)</span>
        <span className="text-right font-mono">{cents(receipt.distanceCharge)}</span>
        <span className="text-muted-foreground">
          Waiting ({receipt.totalWaitingMin.toFixed(1)} min, {receipt.freeWaitingMin} free)
        </span>
        <span className="text-right font-mono">
          {receipt.billableWaitingMin > 0 ? cents(receipt.waitingCharge) : "—"}
        </span>
        {receipt.billableWaitingMin > 0 && (
          <>
            <span className="text-muted-foreground text-[10px] pl-2">
              Billable: {receipt.billableWaitingMin.toFixed(1)} min
            </span>
            <span />
          </>
        )}
      </div>
      <div className="grid grid-cols-2 gap-1 text-xs border-t border-border pt-2">
        <span className="text-muted-foreground">Subtotal</span>
        <span className="text-right font-mono">{cents(receipt.grossFareCents)}</span>
        <span className="text-muted-foreground">Service fee</span>
        <span className="text-right font-mono">{cents(receipt.serviceFeeCents)}</span>
      </div>
      <div className="flex justify-between items-center pt-2 border-t border-border">
        <span className="text-sm font-semibold">Total</span>
        <span className="text-lg font-bold text-primary font-mono">{cents(receipt.totalCents)}</span>
      </div>
    </motion.div>
  );
}

interface TaxiMeterProps {
  rideId: string;
  meterStatus: string;
}

export default function TaxiMeter({ rideId, meterStatus }: TaxiMeterProps) {
  const { state, startMeter, endMeter, toggleWaiting } = useTaxiMeter(rideId, meterStatus);

  return (
    <div className="space-y-3">
      {/* Live meter display */}
      {(state.status === "running" || state.status === "completed") && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-xl bg-background/80 backdrop-blur border border-primary/20 p-5"
        >
          {/* Big fare */}
          <div className="text-center mb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
              {state.status === "running"
                ? state.isWaiting
                  ? "Meter Running — Waiting"
                  : "Meter Running"
                : "Final Fare"}
            </p>
            <motion.p
              key={state.liveFareCents}
              initial={{ scale: 1.05 }}
              animate={{ scale: 1 }}
              className="text-4xl font-bold font-mono text-primary"
            >
              {cents(state.liveFareCents)}
            </motion.p>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="space-y-0.5">
              <div className="flex items-center justify-center gap-1 text-muted-foreground">
                <RouteIcon className="h-3 w-3" />
                <span className="text-[10px] uppercase">Distance</span>
              </div>
              <p className="text-sm font-mono font-semibold">{state.distanceKm.toFixed(2)} km</p>
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center justify-center gap-1 text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span className="text-[10px] uppercase">Waiting</span>
              </div>
              <p className={`text-sm font-mono font-semibold ${state.isWaiting ? "text-yellow-400" : ""}`}>
                {formatTime(state.waitingMin)}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Controls */}
      <div className="flex gap-2">
        {state.status === "idle" && (
          <Button onClick={startMeter} className="flex-1 gap-2">
            <Play className="h-4 w-4" /> Start Meter
          </Button>
        )}
        {state.status === "running" && (
          <>
            <Button
              onClick={toggleWaiting}
              variant={state.isWaiting ? "secondary" : "outline"}
              className="flex-1 gap-2"
            >
              {state.isWaiting ? (
                <><Play className="h-4 w-4" /> Resume</>
              ) : (
                <><Pause className="h-4 w-4" /> Waiting</>
              )}
            </Button>
            <Button onClick={endMeter} variant="destructive" className="flex-1 gap-2">
              <Square className="h-4 w-4" /> End Ride
            </Button>
          </>
        )}
      </div>

      {/* Receipt */}
      <AnimatePresence>
        {state.receipt && <ReceiptBreakdown receipt={state.receipt} />}
      </AnimatePresence>
    </div>
  );
}
