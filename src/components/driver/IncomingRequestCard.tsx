import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Check,
  X,
  Plane,
  Users,
  Clock,
  Banknote,
} from "lucide-react";
import ServiceIcon from "@/components/driver/ServiceIcon";
import DriverBidForm from "@/components/DriverBidForm";
import { serviceLabels, fmt, isAirportTrip, isDeliveryType } from "@/lib/driver-constants";
import { formatDistanceToNowStrict } from "date-fns";
import type { Ride, DeliveryBid } from "@/types/driver";

const AUTO_DECLINE_SECONDS = 30;
const DISPATCH_TIMEOUT_SECONDS = 15;

// ─── Circular countdown ───
function CountdownRing({ secondsLeft, total }: { secondsLeft: number; total: number }) {
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  const progress = secondsLeft / total;
  const dashoffset = circumference * (1 - progress);
  const isUrgent = secondsLeft <= 5;

  return (
    <div className="relative flex items-center justify-center h-9 w-9 shrink-0">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r={radius} fill="none" stroke="hsl(var(--border))" strokeWidth="2.5" />
        <circle
          cx="18" cy="18" r={radius}
          fill="none"
          stroke={isUrgent ? "hsl(var(--destructive))" : "hsl(var(--primary))"}
          strokeWidth="2.5"
          strokeDasharray={circumference}
          strokeDashoffset={dashoffset}
          strokeLinecap="round"
          className="transition-[stroke-dashoffset] duration-1000 linear"
        />
      </svg>
      <span className={`text-[11px] font-bold tabular-nums ${isUrgent ? "text-destructive" : "text-foreground"}`}>
        {secondsLeft}
      </span>
    </div>
  );
}

// ─── Request detail chips ───
function RequestDetails({ ride }: { ride: Ride }) {
  const r = ride as any;
  const chips: { label: string; warn?: boolean }[] = [];

  if (ride.service_type === "courier") {
    if (r.item_description) chips.push({ label: `📦 ${r.item_description}` });
    if (r.marketplace_delivery) chips.push({ label: "Marketplace", warn: true });
    if (r.package_size) chips.push({ label: r.package_size });
  } else if (ride.service_type === "large_delivery") {
    if (r.item_description) chips.push({ label: `📦 ${r.item_description}` });
    if (r.weight_estimate_kg) chips.push({ label: `~${r.weight_estimate_kg} kg` });
    if (r.requires_loading_help) chips.push({ label: "Loading help", warn: true });
    if (r.stairs_involved) chips.push({ label: "Stairs", warn: true });
  } else if (ride.service_type === "retail_delivery") {
    if (r.store_id) chips.push({ label: `🏪 ${r.store_id}` });
    if (r.signature_required) chips.push({ label: "Signature req.", warn: true });
  } else if (ride.service_type === "personal_shopper") {
    if (r.store_name) chips.push({ label: `🏪 ${r.store_name}` });
    if (r.item_description) chips.push({ label: `📦 ${r.item_description}` });
  } else if (ride.service_type === "food_delivery") {
    if (r.store_name) chips.push({ label: `🍽️ ${r.store_name}` });
    if (r.order_value_cents) chips.push({ label: `$${(r.order_value_cents / 100).toFixed(2)}` });
  } else if (ride.service_type === "pet_transport") {
    if (r.pet_type) chips.push({ label: `🐾 ${r.pet_type}` });
    if (r.pet_mode) chips.push({ label: r.pet_mode.replace("_", " ") });
    if (r.destination_type) chips.push({ label: `→ ${r.destination_type}` });
  }

  if (chips.length === 0) return null;

  return (
    <div className="px-4 pb-2 flex flex-wrap gap-1.5">
      {chips.map((c, i) => (
        <span
          key={i}
          className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
            c.warn ? "bg-amber-500/10 text-amber-500" : "bg-secondary text-secondary-foreground"
          }`}
        >
          {c.label}
        </span>
      ))}
    </div>
  );
}

interface IncomingRequestCardProps {
  ride: Ride;
  index: number;
  acceptingId: string | null;
  existingBid: DeliveryBid | null;
  driverId: string;
  onAccept: (rideId: string) => void;
  onDecline: (rideId: string) => void;
  onBidChanged: () => void;
}

export default function IncomingRequestCard({
  ride,
  index,
  acceptingId,
  existingBid,
  driverId,
  onAccept,
  onDecline,
  onBidChanged,
}: IncomingRequestCardProps) {
  const isDispatchedToMe = ride.dispatched_to_driver_id === driverId;

  // Calculate initial seconds from dispatch_expires_at when dispatched to this driver
  const getInitialSeconds = useCallback(() => {
    if (isDispatchedToMe && ride.dispatch_expires_at) {
      const remaining = Math.max(0, Math.ceil((new Date(ride.dispatch_expires_at).getTime() - Date.now()) / 1000));
      return Math.min(remaining, DISPATCH_TIMEOUT_SECONDS);
    }
    return AUTO_DECLINE_SECONDS;
  }, [isDispatchedToMe, ride.dispatch_expires_at]);

  const totalSeconds = isDispatchedToMe ? DISPATCH_TIMEOUT_SECONDS : AUTO_DECLINE_SECONDS;
  const [secondsLeft, setSecondsLeft] = useState(getInitialSeconds);

  useEffect(() => {
    setSecondsLeft(getInitialSeconds());
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [ride.id, getInitialSeconds]);

  useEffect(() => {
    if (secondsLeft === 0) onDecline(ride.id);
  }, [secondsLeft, ride.id, onDecline]);

  return (
    <motion.div
      key={ride.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        "rounded-2xl bg-card overflow-hidden",
        isDispatchedToMe
          ? "ring-2 ring-primary shadow-[0_0_20px_-4px_hsl(var(--primary)/0.3)]"
          : "ring-1 ring-border/50"
      )}
    >
      {/* Dispatched badge */}
      {isDispatchedToMe && (
        <div className="bg-primary/10 px-4 py-1.5 flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
          </span>
          <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
            Dispatched to you
          </span>
        </div>
      )}
      {/* Request header */}
      <div className="flex items-center justify-between px-4 pt-3.5 pb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 shrink-0">
            <ServiceIcon type={ride.service_type} className="h-4.5 w-4.5 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold">{serviceLabels[ride.service_type] || ride.service_type}</span>
              {isAirportTrip(ride) && (
                <span className="flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wider bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                  <Plane className="h-2.5 w-2.5" /> Airport
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              {ride.service_type === "shuttle" && <span>{ride.passenger_count} pax</span>}
              {(ride.service_type === "taxi" || ride.service_type === "private_hire") && ride.passenger_count > 1 && (
                <span className="flex items-center gap-0.5"><Users className="h-2.5 w-2.5" />{ride.passenger_count}</span>
              )}
              {isDeliveryType(ride.service_type) && ride.package_size && (
                <span className="capitalize">{ride.package_size} pkg</span>
              )}
              {ride.scheduled_at && (
                <span className="flex items-center gap-0.5">
                  <Clock className="h-2.5 w-2.5" />
                  {new Date(ride.scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right shrink-0">
            <span className="text-base font-bold text-primary tabular-nums">
              {fmt(Number(ride.estimated_price || 0) * 100)}
            </span>
            {ride.distance_km && (
              <p className="text-[10px] text-muted-foreground tabular-nums">{Number(ride.distance_km).toFixed(1)} km</p>
            )}
            <p className="text-[9px] text-muted-foreground mt-0.5">
              {formatDistanceToNowStrict(new Date(ride.created_at), { addSuffix: true })}
            </p>
          </div>
          <CountdownRing secondsLeft={secondsLeft} total={AUTO_DECLINE_SECONDS} />
        </div>
      </div>

      {/* Addresses */}
      <div className="px-4 py-2 space-y-1.5">
        <div className="flex items-start gap-2">
          <div className="mt-1 h-2 w-2 rounded-full bg-green-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm leading-tight line-clamp-1">{ride.pickup_address}</p>
            {ride.pickup_notes && (
              <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">📝 {ride.pickup_notes}</p>
            )}
          </div>
        </div>
        <div className="flex items-start gap-2">
          <div className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm leading-tight line-clamp-1">{ride.dropoff_address}</p>
            {ride.dropoff_notes && (
              <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">📝 {ride.dropoff_notes}</p>
            )}
          </div>
        </div>
      </div>

      {/* Payment & context chips */}
      {(ride.payment_option === "pay_driver" || ride.billed_to === "organization") && (
        <div className="px-4 pb-1 flex flex-wrap items-center gap-1.5">
          {ride.payment_option === "pay_driver" && (
            <span className="flex items-center gap-1 text-[10px] font-medium bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-full">
              <Banknote className="h-3 w-3" /> Cash
            </span>
          )}
          {ride.billed_to === "organization" && (
            <span className="text-[10px] font-medium bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">
              Corporate
            </span>
          )}
        </div>
      )}

      {/* Extra details */}
      <RequestDetails ride={ride} />

      {/* Actions */}
      <div className="px-4 pb-3 pt-1">
        {ride.service_type === "large_delivery" ? (
          <DriverBidForm
            rideId={ride.id}
            driverId={driverId}
            estimatedPrice={Number(ride.estimated_price || 0)}
            existingBid={existingBid}
            onBidChanged={onBidChanged}
          />
        ) : (
          <div className="flex gap-2">
            <Button
              className="flex-1 h-14 rounded-xl text-[15px] font-bold active:scale-[0.98] transition-transform"
              onClick={() => onAccept(ride.id)}
              disabled={acceptingId === ride.id}
            >
              {acceptingId === ride.id ? (
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              ) : (
                <>
                  <Check className="mr-2 h-5 w-5" />
                  Accept
                </>
              )}
            </Button>
            <Button
              variant="outline"
              className="h-14 w-14 rounded-xl active:scale-[0.98]"
              onClick={() => onDecline(ride.id)}
              disabled={!!acceptingId}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
