import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { MapPin, Clock, Car, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import type { Ride } from "@/types/rider";
import { statusColors } from "@/types/rider";

interface RideDetailSheetProps {
  ride: Ride | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function RideDetailSheet({ ride, open, onOpenChange }: RideDetailSheetProps) {
  const { t } = useTranslation();

  if (!ride) return null;

  const totalFare = ride.final_fare_cents || Math.round((ride.final_price || 0) * 100) || Math.round((ride.estimated_price || 0) * 100);
  const captured = ride.captured_amount_cents || 0;
  const outstanding = ride.outstanding_amount_cents || 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl pb-8">
        <SheetHeader>
          <SheetTitle className="text-left">{t("activity.tripDetails", "Trip Details")}</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 mt-4">
          {/* Status + Service type */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Car className="h-4 w-4 text-primary/70" />
              <span className="text-sm font-semibold capitalize">
                {ride.service_type?.replace("_", " ")}
              </span>
            </div>
            <span className={`text-xs font-bold uppercase tracking-wider ${statusColors[ride.status] || ""}`}>
              {ride.status}
            </span>
          </div>

          {/* Locations */}
          <div className="space-y-2">
            <div className="flex items-start gap-3">
              <div className="mt-1 h-2 w-2 rounded-full bg-green-500 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">{t("rider.pickup", "Pickup")}</p>
                <p className="text-sm">{ride.pickup_address}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">{t("rider.dropoff", "Drop-off")}</p>
                <p className="text-sm">{ride.dropoff_address}</p>
              </div>
            </div>
          </div>

          {/* Date & time */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            {format(new Date(ride.created_at), "EEEE, MMM d yyyy · h:mm a")}
          </div>

          {/* Distance */}
          {ride.distance_km && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              {Number(ride.distance_km).toFixed(1)} km
            </div>
          )}

          {/* Fare breakdown */}
          {totalFare > 0 && (
            <div className="rounded-xl border border-border/50 p-4 space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4 text-primary" />
                <span className="text-sm font-bold">{t("activity.fareBreakdown", "Fare Breakdown")}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("rider.total", "Total fare")}</span>
                <span className="font-mono font-bold">${(totalFare / 100).toFixed(2)}</span>
              </div>
              {ride.service_fee_cents > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("activity.serviceFee", "Service fee")}</span>
                  <span className="font-mono">${(ride.service_fee_cents / 100).toFixed(2)}</span>
                </div>
              )}
              {ride.commission_cents > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("activity.commission", "Commission")}</span>
                  <span className="font-mono">${(ride.commission_cents / 100).toFixed(2)}</span>
                </div>
              )}
              {captured > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("rider.paidInApp", "Paid in-app")}</span>
                  <span className="font-mono">${(captured / 100).toFixed(2)}</span>
                </div>
              )}
              {outstanding > 0 && (
                <div className="flex justify-between text-sm text-yellow-500">
                  <span>{t("rider.amountDueDriver", "Due to driver")}</span>
                  <span className="font-mono font-bold">${(outstanding / 100).toFixed(2)}</span>
                </div>
              )}
            </div>
          )}

          {/* Payment method */}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t("rider.paymentMethod", "Payment")}</span>
            <span className="capitalize">{ride.payment_option.replace("_", " ")}</span>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
