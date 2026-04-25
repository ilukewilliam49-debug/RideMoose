import { DollarSign, Briefcase, Car, Clock, AlertTriangle, Users, MapPin, Package, Accessibility } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PER_STOP_FEE_CENTS } from "@/types/stops";
import {
  computeFare,
  FALLBACK_BYLAW_RATES,
  formatCents,
  type BylawRates,
} from "@/lib/pricing";

interface PriceEstimateProps {
  serviceType: string;
  estimatedPrice: string | null;
  directionsData: any;
  trafficDelayMin: number;
  directionsFetching: boolean;
  passengerCount?: number;
  /** Number of intermediate stops (for surcharge display). */
  stopCount?: number;
  /** Bylaw rates loaded from DB (falls back to defaults). */
  bylawRates?: BylawRates | null;
  /** True when the rider has flagged a wheelchair / accessibility need. */
  accessibilityRequired?: boolean;
}

const PriceEstimate = ({
  serviceType,
  estimatedPrice,
  directionsData,
  trafficDelayMin,
  directionsFetching,
  passengerCount = 1,
  stopCount = 0,
  bylawRates,
  accessibilityRequired = false,
}: PriceEstimateProps) => {
  const { t } = useTranslation();

  if (!estimatedPrice) return null;

  const isMetered = serviceType === "taxi" || serviceType === "private_hire";

  // Non-metered services keep the simple pill (handled below).
  if (!isMetered) return null;

  const rates = bylawRates ?? FALLBACK_BYLAW_RATES;
  const distanceKm = directionsData?.distance_km ?? 0;
  const stopsSurchargeCents = stopCount * PER_STOP_FEE_CENTS;
  const isPickYou = serviceType === "private_hire";
  const breakdown = computeFare(isPickYou ? "pickyou" : "taxi", rates, {
    distanceKm,
    waitingMin: 0,
    largeVehicle: passengerCount >= 5,
    accessibilityRequired,
    pickupDeliveryNoPassenger: false,
  });

  const totalCents = breakdown.totalCents + stopsSurchargeCents;
  const headerLabel = isPickYou
    ? t("rider.pickYouFareHeader", "PickYou Independent Fare")
    : t("rider.taxiFareHeader", "City-Regulated Taxi Fare");
  const HeaderIcon = isPickYou ? Briefcase : DollarSign;

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HeaderIcon className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">{headerLabel}</span>
        </div>
        <div className="text-right">
          <span
            className={`text-2xl font-mono font-bold transition-opacity ${
              directionsFetching ? "opacity-50 animate-pulse" : ""
            }`}
            aria-live="polite"
            aria-busy={directionsFetching}
          >
            {formatCents(totalCents)}
          </span>
          {directionsFetching && (
            <p className="text-[10px] text-muted-foreground">
              {t("rider.recalculatingFare", "Recalculating…")}
            </p>
          )}
        </div>
      </div>

      {/* Breakdown */}
      <div className="space-y-1 pt-1 border-t border-border/50">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>
            {t("rider.fareBaseFlag", "Flag rate")}{" "}
            <span className="opacity-70">
              ({t("rider.fareIncludedFirst", "incl. first {{m}} m", { m: rates.included_meters })})
            </span>
          </span>
          <span>{formatCents(breakdown.baseFareCents)}</span>
        </div>

        <div className="flex justify-between text-xs text-muted-foreground">
          <span>
            {t("rider.fareDistance", "Distance")}{" "}
            <span className="opacity-70">
              ({distanceKm.toFixed(2)} km · {formatCents(rates.per_increment_cents)}/{rates.increment_meters}m)
            </span>
          </span>
          <span>{formatCents(breakdown.distanceChargeCents)}</span>
        </div>

        {breakdown.largeVehicleSurchargeCents > 0 && (
          <div className="flex justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {t("rider.largeVehicleSurcharge", "Large vehicle ({{n}} pax)", { n: passengerCount })}
            </span>
            <span>{formatCents(breakdown.largeVehicleSurchargeCents)}</span>
          </div>
        )}

        {accessibilityRequired && passengerCount >= 5 && (
          <div className="flex justify-between text-xs text-primary">
            <span className="flex items-center gap-1">
              <Accessibility className="h-3 w-3" />
              {t("rider.accessibilityWaived", "Accessibility — surcharge waived")}
            </span>
            <span>−{formatCents(rates.large_vehicle_surcharge_cents)}</span>
          </div>
        )}

        {stopCount > 0 && (
          <div className="flex justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {t("rider.fareStops", "Stops ({{n}} × {{fee}})", {
                n: stopCount,
                fee: formatCents(PER_STOP_FEE_CENTS),
              })}
            </span>
            <span>{formatCents(stopsSurchargeCents)}</span>
          </div>
        )}

        {isPickYou && (
          <>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{t("rider.fareGst", "GST (5%)")}</span>
              <span>{formatCents(breakdown.taxCents)}</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Package className="h-3 w-3" />
                {t("rider.farePlatformFee", "PickYou platform fee")}
              </span>
              <span>{formatCents(breakdown.platformFeeCents)}</span>
            </div>
          </>
        )}
      </div>

      {/* Route */}
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
            <div className="flex items-center gap-2 text-sm text-warning">
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
        {isPickYou
          ? t("rider.pickYouPricingNote", "Estimate uses the City of Yellowknife taxi meter base, plus 5% GST and a $0.97 PickYou platform fee. Waiting time is billed live by the meter.")
          : t("rider.taxiPricingNote", "City of Yellowknife regulated taxi rate. No GST. No service fee. Waiting time is billed live by the meter (first 3 minutes free).")}
      </p>
    </div>
  );
};

export default PriceEstimate;
