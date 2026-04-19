import { useState } from "react";
import { useTranslation } from "react-i18next";
import { format, addMinutes } from "date-fns";
import { Clock, ChevronDown, Check, CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useRideBooking } from "@/contexts/RideBookingContext";
import { toast } from "sonner";

/**
 * PickupTimeSelector — Uber-style "Pickup now / Schedule for later" pill.
 * Reads/writes scheduledAt from RideBookingContext.
 * Validates past times and required selection for "later".
 */
export default function PickupTimeSelector({ className }: { className?: string }) {
  const { t } = useTranslation();
  const { scheduledAt, setScheduledAt, resetSchedule } = useRideBooking();

  const [open, setOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customDate, setCustomDate] = useState<Date | undefined>(scheduledAt ?? undefined);
  const [customTime, setCustomTime] = useState(
    scheduledAt ? format(scheduledAt, "HH:mm") : "12:00"
  );

  const label = scheduledAt ? format(scheduledAt, "MMM d, h:mm a") : t("rider.pickupNow", "Pickup now");

  const handleNow = () => {
    resetSchedule();
    setShowCustom(false);
    setOpen(false);
  };

  const handlePreset = (mins: number) => {
    setScheduledAt(addMinutes(new Date(), mins));
    setShowCustom(false);
    setOpen(false);
  };

  const handleCustomConfirm = () => {
    if (!customDate) {
      toast.error(t("rider.pickADate", "Please pick a date"));
      return;
    }
    const [h, m] = customTime.split(":").map(Number);
    const dt = new Date(customDate);
    dt.setHours(h, m, 0, 0);
    if (dt.getTime() <= Date.now()) {
      toast.error(t("rider.pastTimeError", "Pickup time must be in the future"));
      return;
    }
    setScheduledAt(dt);
    setShowCustom(false);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "group flex items-center gap-2 rounded-full border px-3.5 py-2 transition-all active:scale-95",
            scheduledAt
              ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/15"
              : "border-border/60 bg-secondary hover:bg-accent",
            className
          )}
        >
          <Clock
            className={cn(
              "h-4 w-4 transition-transform group-hover:-rotate-12",
              scheduledAt ? "text-primary" : "text-foreground"
            )}
          />
          <span className="text-sm font-semibold max-w-[140px] truncate">{label}</span>
          <ChevronDown
            className={cn("h-3.5 w-3.5 opacity-60 transition-transform", open && "rotate-180")}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 p-3 z-[1400]"
        align="start"
        sideOffset={8}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {!showCustom ? (
          <div className="space-y-1">
            <button
              onClick={handleNow}
              className={cn(
                "w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-between",
                !scheduledAt ? "bg-primary/10 text-primary" : "hover:bg-accent"
              )}
            >
              <span>{t("rider.pickupNow", "Pickup now")}</span>
              {!scheduledAt && <Check className="h-4 w-4" />}
            </button>
            {[
              { m: 15, label: t("rider.in15", "In 15 mins") },
              { m: 30, label: t("rider.in30", "In 30 mins") },
              { m: 60, label: t("rider.in60", "In 1 hour") },
            ].map(({ m, label: lab }) => (
              <button
                key={m}
                onClick={() => handlePreset(m)}
                className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-accent transition-colors"
              >
                {lab}
              </button>
            ))}
            <button
              onClick={() => setShowCustom(true)}
              className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-accent transition-colors flex items-center gap-2"
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              {t("rider.scheduleForLater", "Schedule for later")}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <Calendar
              mode="single"
              selected={customDate}
              onSelect={setCustomDate}
              disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
              className={cn("p-2 pointer-events-auto")}
            />
            <div className="flex items-center gap-2">
              <Input
                type="time"
                value={customTime}
                onChange={(e) => setCustomTime(e.target.value)}
                className="flex-1"
              />
              <Button size="sm" onClick={handleCustomConfirm} disabled={!customDate}>
                {t("common.set", "Set")}
              </Button>
            </div>
            <button
              onClick={() => setShowCustom(false)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              ← {t("common.back", "Back")}
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
