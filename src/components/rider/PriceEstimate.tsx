import { DollarSign, Briefcase, Car, Clock, AlertTriangle, Users } from "lucide-react";
import { useTranslation } from "react-i18next";

interface PriceEstimateProps {
  serviceType: string;
  estimatedPrice: string | null;
  directionsData: any;
  trafficDelayMin: number;
  directionsFetching: boolean;
  passengerCount?: number;
}

const PriceEstimate = ({
  serviceType, estimatedPrice, directionsData, trafficDelayMin, directionsFetching, passengerCount = 1,
}: PriceEstimateProps) => {
  const { t } = useTranslation();

  if (!estimatedPrice) return null;

  const priceNum = parseFloat(estimatedPrice);
  const largeGroupSurcharge = passengerCount >= 5 ? 6 : 0;
  const fareBeforeSurcharge = priceNum - largeGroupSurcharge;

  if (serviceType === "private_hire") {
    const surcharge = 2.99;
    const subtotal = priceNum + surcharge;
    const gstAmount = (subtotal * 0.05).toFixed(2);
    const totalWithTax = (subtotal * 1.05).toFixed(2);

    return (
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">{t("rider.pickYouEstimate", "PickYou Estimate")}</span>
          </div>
          <div className="text-right">
            <span className="text-2xl font-mono font-bold">${totalWithTax}</span>
          </div>
        </div>
        <div className="space-y-1 pt-1 border-t border-border/50">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Fare</span>
            <span>${estimatedPrice}</span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>PickYou Surcharge</span>
            <span>${surcharge.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>GST (5%)</span>
            <span>${gstAmount}</span>
          </div>
        </div>
        {directionsData && (
          <div className="space-y-1 pt-1 border-t border-border/50">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Car className="h-3.5 w-3.5" />
              <span>{t("rider.route")}: {directionsData.distance_km.toFixed(1)} km</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>{t("rider.eta")}: {directionsData.duration_in_traffic_text || directionsData.duration_text}</span>
            </div>
            {trafficDelayMin >= 1 && (
              <div className="flex items-center gap-2 text-sm text-yellow-500">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>{t("rider.trafficDelay", { min: Math.round(trafficDelayMin) })}</span>
              </div>
            )}
          </div>
        )}
        {directionsFetching && !directionsData && (
          <p className="text-xs text-muted-foreground animate-pulse">{t("rider.checkingTraffic")}</p>
        )}
        <p className="text-[10px] text-muted-foreground">
          {t("rider.pickYouPricingNote", "Estimate based on distance, travel time, and current PickYou pricing. GST included.")}
        </p>
      </div>
    );
  }

  if (serviceType === "taxi") {
    return (
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">{t("rider.taxiMeterEstimate")}</span>
          </div>
          <div className="text-right">
            <span className="text-2xl font-mono font-bold">${estimatedPrice}</span>
          </div>
        </div>
        {directionsData && (
          <div className="space-y-1 pt-1 border-t border-border/50">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Car className="h-3.5 w-3.5" />
              <span>{t("rider.route")}: {directionsData.distance_km.toFixed(1)} km</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>{t("rider.eta")}: {directionsData.duration_in_traffic_text}</span>
            </div>
            {trafficDelayMin >= 1 && (
              <div className="flex items-center gap-2 text-sm text-yellow-500">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>{t("rider.trafficDelay", { min: Math.round(trafficDelayMin) })}</span>
              </div>
            )}
          </div>
        )}
        {directionsFetching && !directionsData && (
          <p className="text-xs text-muted-foreground animate-pulse">{t("rider.checkingTraffic")}</p>
        )}
        <p className="text-[10px] text-muted-foreground">{t("rider.finalFareNote")}. Metered fare only — no tax added.</p>
      </div>
    );
  }

  return null;
};

export default PriceEstimate;
