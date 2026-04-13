import { useState } from "react";
import { Star, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import TipDialog from "./TipDialog";

interface RideHistoryProps {
  rides: any[] | undefined;
  statusColor: Record<string, string>;
  onRate: (rideId: string, driverId: string) => void;
  onRefresh?: () => void;
}

const RideHistory = ({ rides, statusColor, onRate, onRefresh }: RideHistoryProps) => {
  const { t } = useTranslation();
  const [tipRide, setTipRide] = useState<{ id: string; driverId: string } | null>(null);

  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">{t("rider.recentRides")}</h2>
      <div className="space-y-2">
        {rides?.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("rider.noRidesYet")}</p>
        )}
        {rides?.map((ride) => {
          const grossFare = ride.final_fare_cents || Math.round((ride.final_price || 0) * 100) || Math.round((ride.estimated_price || 0) * 100);
          const isPrivateHire = ride.service_type === "private_hire";
          const surchargeCents = isPrivateHire ? 120 : 0; // $1.20 PickYou surcharge
          const taxCents = ride.tax_cents || 0;
          const serviceFee = ride.service_fee_cents || 0;
          const totalFare = grossFare + surchargeCents + taxCents + serviceFee;
          const captured = ride.captured_amount_cents || 0;
          const outstanding = ride.outstanding_amount_cents || 0;
          const hasTip = (ride.tip_cents || 0) > 0;
          return (
            <div key={ride.id} className="glass-surface rounded-lg p-4 flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono uppercase px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">
                    {ride.service_type === "private_hire" ? t("rider.privateHireFlatRate") : ride.service_type}
                  </span>
                  <p className="text-sm font-medium">{ride.pickup_address} → {ride.dropoff_address}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {new Date(ride.created_at).toLocaleDateString()}
                </p>
                {ride.status === "completed" && totalFare > 0 && (
                  <div className="text-[10px] font-mono text-muted-foreground space-x-2">
                    <span>{t("rider.total")}: ${(totalFare / 100).toFixed(2)}{isPrivateHire && <span className="text-muted-foreground/70 ml-0.5">(incl. GST)</span>}</span>
                    {captured > 0 && <span>• {t("rider.inApp")}: ${(captured / 100).toFixed(2)}</span>}
                    {outstanding > 0 && <span className="text-yellow-500">• {t("rider.due")}: ${(outstanding / 100).toFixed(2)}</span>}
                    {hasTip && <span className="text-primary">• {t("rider.tip", "Tip")}: ${(ride.tip_cents / 100).toFixed(2)}</span>}
                  </div>
                )}
                {ride.status === "completed" && ride.service_type === "large_delivery" && totalFare > 0 && (
                  <div className="mt-1 text-[10px] font-mono text-muted-foreground border-t border-border pt-1 space-y-0.5">
                    <div className="flex justify-between gap-4">
                      <span>{t("rider.bidAmountLabel")}</span>
                      <span>${(totalFare / 100).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span>{t("rider.platformFee")}</span>
                      <span>-${((ride.commission_cents || Math.round(totalFare * 0.08)) / 100).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span>{t("rider.processingFeeLabel")}</span>
                      <span>-${((ride.stripe_fee_cents || Math.round(totalFare * 0.029 + 30)) / 100).toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>
              <div className="text-right flex items-center gap-2">
                {ride.status === "completed" && ride.driver_id && !hasTip && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs gap-1"
                    onClick={() => setTipRide({ id: ride.id, driverId: ride.driver_id })}
                  >
                    <DollarSign className="h-3.5 w-3.5" /> {t("rider.addTip", "Tip")}
                  </Button>
                )}
                {ride.status === "completed" && ride.driver_id && (
                  <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => onRate(ride.id, ride.driver_id)}>
                    <Star className="h-3.5 w-3.5" /> {t("rider.rate")}
                  </Button>
                )}
                <div>
                  <p className={`text-xs font-mono uppercase ${statusColor[ride.status] || ""}`}>
                    {t(`rider.status_${ride.status}`)}
                  </p>
                  {ride.payment_status === "partial" && (
                    <p className="text-[10px] font-mono text-yellow-500">{t("rider.partialPayment")}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {tipRide && (
        <TipDialog
          open={!!tipRide}
          onOpenChange={(open) => { if (!open) setTipRide(null); }}
          rideId={tipRide.id}
          onTipped={() => {
            setTipRide(null);
            onRefresh?.();
          }}
        />
      )}
    </div>
  );
};

export default RideHistory;
