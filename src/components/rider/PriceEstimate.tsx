import { DollarSign, Briefcase, MapPinned, Car, Clock, AlertTriangle } from "lucide-react";
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
  serviceType, estimatedPrice, matchedZone, pickupZoneKey, dropoffZoneKey,
  geoZones, directionsData, trafficDelayMin, directionsFetching,
}: PriceEstimateProps) => {
  const { t } = useTranslation();

  if (!estimatedPrice) return null;

  if (serviceType === "private_hire") {
    return (
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">{t("rider.privateHireFlatRate")}</span>
        </div>
        <div className="flex items-center gap-2">
          <MapPinned className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            {matchedZone ? matchedZone.zone_name : t("rider.standardRoute")}
          </span>
        </div>
        {pickupZoneKey && dropoffZoneKey && (
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="px-1.5 py-0.5 rounded bg-secondary">{geoZones?.find(g => g.zone_key === pickupZoneKey)?.zone_name || pickupZoneKey}</span>
            <span>→</span>
            <span className="px-1.5 py-0.5 rounded bg-secondary">{geoZones?.find(g => g.zone_key === dropoffZoneKey)?.zone_name || dropoffZoneKey}</span>
            {!matchedZone && <span className="italic ml-1">{t("rider.noZoneMatch")}</span>}
          </div>
        )}
        <p className="text-2xl font-mono font-bold">${estimatedPrice}</p>
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
