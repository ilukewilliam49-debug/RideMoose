import { DollarSign, Briefcase, Car, Clock, AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";

interface PriceEstimateProps {
  serviceType: string;
  estimatedPrice: string | null;
  matchedZone: any;
  pickupZoneKey: string | null;
  dropoffZoneKey: string | null;
  geoZones: any[] | undefined;
  directionsData: any;
  trafficDelayMin: number;
  directionsFetching: boolean;
}

const PriceEstimate = ({
  serviceType, estimatedPrice, directionsData, trafficDelayMin, directionsFetching,
}: PriceEstimateProps) => {
  const { t } = useTranslation();

  if (!estimatedPrice) return null;

  if (serviceType === "private_hire") {
    return (
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">{t("rider.pickYouEstimate", "PickYou Estimate")}</span>
          </div>
          <span className="text-2xl font-mono font-bold">${estimatedPrice}</span>
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
          {t("rider.pickYouPricingNote", "Estimate based on distance, travel time, and current PickYou pricing")}
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
          <span className="text-2xl font-mono font-bold">${estimatedPrice}</span>
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
        <p className="text-[10px] text-muted-foreground">{t("rider.finalFareNote")}</p>
      </div>
    );
  }

  return null;
};

export default PriceEstimate;
