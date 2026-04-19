import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { User, UserPlus, ChevronDown, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useRideBooking, type BookingFor } from "@/contexts/RideBookingContext";
import { toast } from "sonner";

/**
 * RiderSelector — Uber-style "For me / For someone else" pill.
 * Reads/writes bookingFor + guestName + guestPhone via RideBookingContext.
 * Validates that guest fields are filled before confirming.
 */
export default function RiderSelector({ className }: { className?: string }) {
  const { t } = useTranslation();
  const { bookingFor, guestName, guestPhone, setBookingFor, setGuest } = useRideBooking();

  const [open, setOpen] = useState(false);
  // Drafts so we don't mutate context until "Confirm"
  const [draftMode, setDraftMode] = useState<BookingFor>(bookingFor);
  const [draftName, setDraftName] = useState(guestName);
  const [draftPhone, setDraftPhone] = useState(guestPhone);

  useEffect(() => {
    if (open) {
      setDraftMode(bookingFor);
      setDraftName(guestName);
      setDraftPhone(guestPhone);
    }
  }, [open, bookingFor, guestName, guestPhone]);

  const label =
    bookingFor === "self"
      ? t("rider.forMe", "For me")
      : guestName
        ? guestName.split(" ")[0]
        : t("rider.forSomeoneElse", "For someone else");

  const phoneRegex = /^\+?[\d\s\-()]{7,}$/;

  const confirm = () => {
    if (draftMode === "guest") {
      const name = draftName.trim();
      const phone = draftPhone.trim();
      if (!name) {
        toast.error(t("rider.guestNameRequired", "Please enter the rider's name"));
        return;
      }
      if (!phoneRegex.test(phone)) {
        toast.error(t("rider.guestPhoneInvalid", "Please enter a valid phone number"));
        return;
      }
      setBookingFor("guest");
      setGuest(name, phone);
    } else {
      setBookingFor("self"); // automatically clears guest fields in context
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "group flex items-center gap-2 rounded-full border px-3.5 py-2 transition-all active:scale-95",
            bookingFor === "guest"
              ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/15"
              : "border-border/60 bg-secondary hover:bg-accent",
            className
          )}
        >
          {bookingFor === "guest" ? (
            <UserPlus className="h-4 w-4 text-primary" />
          ) : (
            <User className="h-4 w-4 text-foreground transition-transform group-hover:scale-110" />
          )}
          <span className="text-sm font-semibold max-w-[140px] truncate">{label}</span>
          <ChevronDown
            className={cn("h-3.5 w-3.5 opacity-60 transition-transform", open && "rotate-180")}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 p-3 z-[1400]"
        align="start"
        sideOffset={8}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="space-y-1 mb-2">
          <button
            onClick={() => setDraftMode("self")}
            className={cn(
              "w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-between",
              draftMode === "self" ? "bg-primary/10 text-primary" : "hover:bg-accent"
            )}
          >
            <span className="flex items-center gap-2">
              <User className="h-4 w-4" />
              {t("rider.forMe", "For me")}
            </span>
            {draftMode === "self" && <Check className="h-4 w-4" />}
          </button>
          <button
            onClick={() => setDraftMode("guest")}
            className={cn(
              "w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-between",
              draftMode === "guest" ? "bg-primary/10 text-primary" : "hover:bg-accent"
            )}
          >
            <span className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              {t("rider.forSomeoneElse", "For someone else")}
            </span>
            {draftMode === "guest" && <Check className="h-4 w-4" />}
          </button>
        </div>
        {draftMode === "guest" && (
          <div className="space-y-2 pt-2 border-t border-border/40">
            <Input
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              placeholder={t("rider.contactName", "Rider name")}
              className="h-9"
              maxLength={80}
            />
            <Input
              value={draftPhone}
              onChange={(e) => setDraftPhone(e.target.value)}
              placeholder={t("rider.contactPhone", "Phone number")}
              type="tel"
              className="h-9"
              maxLength={20}
            />
          </div>
        )}
        <Button
          size="sm"
          className="w-full mt-3 rounded-full"
          onClick={confirm}
          disabled={draftMode === "guest" && (!draftName.trim() || !draftPhone.trim())}
        >
          {t("common.confirm", "Confirm")}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
