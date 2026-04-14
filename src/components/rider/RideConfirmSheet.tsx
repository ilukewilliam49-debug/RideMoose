import { useTranslation } from "react-i18next";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { MapPin, CreditCard, Banknote, Clock } from "lucide-react";
import { serviceLabels } from "@/lib/driver-constants";

interface RideConfirmSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  pickup: string;
  dropoff: string;
  serviceType: string;
  estimatedPrice: string | null;
  paymentOption: string;
  scheduledAt?: string | null;
  loading?: boolean;
}

export default function RideConfirmSheet({
  open, onOpenChange, onConfirm,
  pickup, dropoff, serviceType, estimatedPrice,
  paymentOption, scheduledAt, loading,
}: RideConfirmSheetProps) {
  const { t } = useTranslation();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl px-5 pb-8">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-center text-lg">
            {t("rider.confirmRide", "Confirm Your Ride")}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4">
          {/* Route */}
          <div className="space-y-2">
            <div className="flex items-start gap-3">
              <div className="mt-1.5 h-2.5 w-2.5 rounded-full bg-green-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{t("rider.pickup")}</p>
                <p className="text-sm font-medium truncate">{pickup}</p>
              </div>
            </div>
            <div className="ml-[5px] h-4 border-l-2 border-dashed border-border/50" />
            <div className="flex items-start gap-3">
              <div className="mt-1.5 h-2.5 w-2.5 rounded-full bg-primary shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{t("rider.dropoff")}</p>
                <p className="text-sm font-medium truncate">{dropoff}</p>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="rounded-xl border border-border bg-secondary/50 p-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t("rider.service", "Service")}</span>
              <span className="font-medium capitalize">{serviceLabels[serviceType] || serviceType}</span>
            </div>
            {estimatedPrice && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("rider.estimatedPrice", "Estimated Price")}</span>
                <span className="font-bold text-primary">${estimatedPrice}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t("rider.paymentMethod")}</span>
              <span className="font-medium flex items-center gap-1.5">
                {paymentOption === "in_app" ? (
                  <><CreditCard className="h-3.5 w-3.5" /> {t("rider.payInApp")}</>
                ) : (
                  <><Banknote className="h-3.5 w-3.5" /> {t("rider.payDriver")}</>
                )}
              </span>
            </div>
            {scheduledAt && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("rider.scheduled", "Scheduled")}</span>
                <span className="font-medium flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {new Date(scheduledAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              {t("rider.edit", "Edit")}
            </Button>
            <Button className="flex-1" onClick={onConfirm} disabled={loading}>
              {loading ? t("rider.requesting") : t("rider.confirmAndRequest", "Confirm & Request")}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
