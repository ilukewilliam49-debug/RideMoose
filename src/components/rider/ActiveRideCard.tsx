import { motion } from "framer-motion";
import { CreditCard, Star, Car } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTranslation } from "react-i18next";
import RideChatSheet from "@/components/RideChatSheet";
import DeliveryBidsList from "@/components/DeliveryBidsList";
import RideSafetyActions from "@/components/rider/RideSafetyActions";

interface DriverProfile {
  full_name?: string | null;
  avatar_url?: string | null;
  vehicle_make?: string | null;
  vehicle_model?: string | null;
  vehicle_color?: string | null;
  vehicle_year?: number | null;
  license_plate?: string | null;
  average_rating?: number | null;
  total_ratings?: number | null;
  latitude?: number | null;
  longitude?: number | null;
}

interface ActiveRideCardProps {
  activeRide: any;
  driverName?: string | null;
  driverProfile?: DriverProfile | null;
  statusColor: Record<string, string>;
  onCancelClick: () => void;
}

const ActiveRideCard = ({ activeRide, driverName, driverProfile, statusColor, onCancelClick }: ActiveRideCardProps) => {
  const { t } = useTranslation();

  const vehicleInfo = driverProfile
    ? [driverProfile.vehicle_color, driverProfile.vehicle_year, driverProfile.vehicle_make, driverProfile.vehicle_model]
        .filter(Boolean).join(" ")
    : null;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="glass-surface rounded-lg p-4 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono uppercase px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
            {activeRide.service_type === "private_hire" ? t("rider.privateHireFlatRate") : activeRide.service_type}
          </span>
          <p className="text-sm font-medium">{activeRide.pickup_address} → {activeRide.dropoff_address}</p>
        </div>
        <p className={`text-xs font-mono uppercase ${statusColor[activeRide.status]}`}>
          {activeRide.status === "accepted" && driverProfile?.latitude && activeRide.pickup_lat && activeRide.pickup_lng
            ? (() => {
                const dlat = (driverProfile.latitude! - activeRide.pickup_lat) * 111320;
                const dlng = (driverProfile.longitude! - activeRide.pickup_lng) * 111320 * Math.cos(activeRide.pickup_lat * Math.PI / 180);
                const dist = Math.sqrt(dlat * dlat + dlng * dlng);
                return dist < 100
                  ? t("rider.driverArrived", "Your driver has arrived!")
                  : t(`rider.status_${activeRide.status}`);
              })()
            : t(`rider.status_${activeRide.status}`)}
        </p>

        {/* Driver info card */}
        {driverProfile && driverName && (
          <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-card p-3 mt-2">
            <Avatar className="h-12 w-12 shrink-0">
              <AvatarImage src={driverProfile.avatar_url || undefined} alt={driverName} />
              <AvatarFallback className="bg-primary/10 text-primary font-bold">
                {driverName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">{driverName}</p>
              {vehicleInfo && (
                <div className="flex items-center gap-1 mt-0.5">
                  <Car className="h-3 w-3 text-muted-foreground shrink-0" />
                  <p className="text-xs text-muted-foreground truncate">{vehicleInfo}</p>
                </div>
              )}
              {driverProfile.license_plate && (
                <span className="inline-block mt-1 text-[11px] font-mono font-bold bg-secondary px-2 py-0.5 rounded">
                  {driverProfile.license_plate}
                </span>
              )}
            </div>
            {driverProfile.average_rating && (
              <div className="flex items-center gap-1 shrink-0 bg-secondary rounded-lg px-2 py-1">
                <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
                <span className="text-sm font-bold">{Number(driverProfile.average_rating).toFixed(1)}</span>
              </div>
            )}
          </div>
        )}

        {!driverProfile && driverName && (
          <p className="text-xs text-muted-foreground">{t("rider.driver")}: {driverName}</p>
        )}

        {activeRide.service_type === "large_delivery" && activeRide.payment_status === "authorized" && (activeRide.authorized_amount_cents ?? 0) > 0 && (
          <div className="mt-2 flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
            <CreditCard className="h-4 w-4 text-primary shrink-0" />
            <div>
              <p className="text-xs font-medium text-primary">{t("rider.paymentAuthorizedLabel")}</p>
              <p className="text-[10px] text-muted-foreground font-mono">
                {t("rider.heldCaptured", { amount: ((activeRide.authorized_amount_cents ?? 0) / 100).toFixed(2) })}
              </p>
            </div>
          </div>
        )}
        {activeRide.service_type === "large_delivery" && activeRide.status === "requested" && (
          <div className="mt-3">
            <DeliveryBidsList rideId={activeRide.id} />
          </div>
        )}
        {(activeRide.status === "accepted" || activeRide.status === "in_progress") && (
          <div className="mt-2">
            <RideSafetyActions
              rideId={activeRide.id}
              pickupAddress={activeRide.pickup_address}
              dropoffAddress={activeRide.dropoff_address}
              driverName={driverName}
              serviceType={activeRide.service_type}
            />
          </div>
        )}
        {(activeRide.status === "requested" || activeRide.status === "accepted") && (
          <div className="flex gap-2 mt-2">
            {activeRide.driver_id && (
              <RideChatSheet rideId={activeRide.id} otherPartyName={driverName || undefined} />
            )}
            <Button variant="destructive" size="sm" className="flex-1" onClick={onCancelClick}>
              {t("rider.cancelRide")}
            </Button>
          </div>
        )}
        {activeRide.status === "in_progress" && activeRide.driver_id && (
          <div className="mt-2">
            <RideChatSheet rideId={activeRide.id} otherPartyName={driverName || undefined} />
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default ActiveRideCard;
