import { motion } from "framer-motion";
import { CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import RideChatSheet from "@/components/RideChatSheet";
import DeliveryBidsList from "@/components/DeliveryBidsList";

interface ActiveRideCardProps {
  activeRide: any;
  driverName?: string | null;
  statusColor: Record<string, string>;
  onCancelClick: () => void;
}

const ActiveRideCard = ({ activeRide, driverName, statusColor, onCancelClick }: ActiveRideCardProps) => {
  const { t } = useTranslation();

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
          {t(`rider.status_${activeRide.status}`)}
        </p>
        {driverName && (
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
