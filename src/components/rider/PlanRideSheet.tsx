import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { format, addMinutes } from "date-fns";
import { ArrowLeft, Clock, User, MapPin, LocateFixed, Map as MapIcon, ChevronRight, CalendarIcon, ChevronDown, Check, UserPlus } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useState } from "react";
import { cn } from "@/lib/utils";
import AddressAutocomplete from "@/components/map/AddressAutocomplete";
import SavedPlaceChips from "@/components/rider/SavedPlaceChips";
import RouteStopsEditor from "@/components/rider/RouteStopsEditor";
import { encodeStopsParam, type RideStop } from "@/types/stops";
import type { SavedPlace } from "@/types/rider";

interface PlanRideSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pickupAddress: string;
  setPickupAddress: (v: string) => void;
  pickupCoords: { lat: number; lng: number } | null;
  setPickupCoords: (c: { lat: number; lng: number } | null) => void;
  destination: string;
  setDestination: (v: string) => void;
  dropoffCoords: { lat: number; lng: number } | null;
  setDropoffCoords: (c: { lat: number; lng: number } | null) => void;
  scheduledAt: Date | null;
  setScheduledAt: (d: Date | null) => void;
  setUserLocation: (l: { lat: number; lng: number } | null) => void;
  savedPlaces?: SavedPlace[];
  onRequestMapPick?: () => void;
  /** Optional intermediate stops between pickup and dropoff (max 3). */
  stops?: RideStop[];
  setStops?: (stops: RideStop[]) => void;
}

export default function PlanRideSheet({
  open,
  onOpenChange,
  pickupAddress,
  setPickupAddress,
  pickupCoords,
  setPickupCoords,
  destination,
  setDestination,
  dropoffCoords,
  setDropoffCoords,
  scheduledAt,
  setScheduledAt,
  setUserLocation,
  savedPlaces = [],
  onRequestMapPick,
  stops,
  setStops,
}: PlanRideSheetProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dropoffRef = useRef<HTMLDivElement>(null);

  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customDate, setCustomDate] = useState<Date | undefined>(undefined);
  const [customTime, setCustomTime] = useState("12:00");

  // "For me" / "For someone else"
  const [riderOpen, setRiderOpen] = useState(false);
  const [riderMode, setRiderMode] = useState<"me" | "other">("me");
  const [riderName, setRiderName] = useState("");
  const [riderPhone, setRiderPhone] = useState("");
  const [draftMode, setDraftMode] = useState<"me" | "other">("me");
  const [draftName, setDraftName] = useState("");
  const [draftPhone, setDraftPhone] = useState("");

  const riderLabel =
    riderMode === "me"
      ? t("rider.forMe", "For me")
      : riderName
        ? riderName.split(" ")[0]
        : t("rider.forSomeoneElse", "For someone else");

  const openRiderPopover = (open: boolean) => {
    if (open) {
      setDraftMode(riderMode);
      setDraftName(riderName);
      setDraftPhone(riderPhone);
    }
    setRiderOpen(open);
  };

  const confirmRider = () => {
    setRiderMode(draftMode);
    if (draftMode === "other") {
      setRiderName(draftName.trim());
      setRiderPhone(draftPhone.trim());
    } else {
      setRiderName("");
      setRiderPhone("");
    }
    setRiderOpen(false);
  };

  // Autofocus the dropoff input when sheet opens
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => {
      const input = dropoffRef.current?.querySelector("input");
      input?.focus();
    }, 250);
    return () => clearTimeout(id);
  }, [open]);

  const scheduleLabel = scheduledAt
    ? format(scheduledAt, "MMM d, h:mm a")
    : t("rider.pickupNow", "Pickup now");

  const handlePreset = (mins: number) => {
    setScheduledAt(addMinutes(new Date(), mins));
    setShowCustom(false);
    setScheduleOpen(false);
  };
  const handleNow = () => {
    setScheduledAt(null);
    setShowCustom(false);
    setScheduleOpen(false);
  };
  const handleCustomConfirm = () => {
    if (!customDate) return;
    const [h, m] = customTime.split(":").map(Number);
    const dt = new Date(customDate);
    dt.setHours(h, m, 0, 0);
    setScheduledAt(dt);
    setShowCustom(false);
    setScheduleOpen(false);
  };

  const useMyLocation = async () => {
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 })
      );
      const { latitude, longitude } = pos.coords;
      setPickupCoords({ lat: latitude, lng: longitude });
      setUserLocation({ lat: latitude, lng: longitude });
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
      const geo = await res.json();
      setPickupAddress(geo.display_name || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
    } catch {
      // ignore
    }
  };

  const canContinue = !!pickupAddress && !!destination;

  const handleContinue = () => {
    const base = "/rider/rides";
    let params = "";
    if (pickupAddress && pickupCoords) {
      params += `?pickup=${encodeURIComponent(pickupAddress)}&plat=${pickupCoords.lat}&plng=${pickupCoords.lng}`;
    }
    if (destination && dropoffCoords) {
      const sep = params ? "&" : "?";
      params += `${sep}dropoff=${encodeURIComponent(destination)}&dlat=${dropoffCoords.lat}&dlng=${dropoffCoords.lng}`;
    }
    if (stops && stops.length > 0) {
      const validStops = stops.filter((s) => s.address && s.lat && s.lng);
      if (validStops.length > 0) {
        const sep = params ? "&" : "?";
        params += `${sep}stops=${encodeStopsParam(validStops)}`;
      }
    }
    if (scheduledAt) {
      const sep = params ? "&" : "?";
      params += `${sep}scheduledAt=${scheduledAt.toISOString()}`;
    }
    onOpenChange(false);
    navigate(`${base}${params}`);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[100dvh] w-full max-w-full p-0 rounded-t-2xl flex flex-col gap-0 border-0 sm:max-w-full"
      >
        <SheetTitle className="sr-only">{t("rider.planYourRide", "Plan your ride")}</SheetTitle>
        <SheetDescription className="sr-only">
          {t("rider.planYourRide", "Plan your ride")}
        </SheetDescription>
        {/* Header */}
        <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-border/30">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent transition-colors"
            aria-label={t("common.back", "Back")}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="flex-1 text-center text-base font-bold pr-9">
            {t("rider.planYourRide", "Plan your ride")}
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pt-4 pb-4 space-y-4">
          {/* Chip row — Uber-style action pills */}
          <div className="flex items-center gap-2">
            <Popover open={scheduleOpen} onOpenChange={setScheduleOpen}>
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    "group flex items-center gap-2 rounded-full border px-3.5 py-2 transition-all active:scale-95",
                    scheduledAt
                      ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/15"
                      : "border-border/60 bg-secondary hover:bg-accent"
                  )}
                >
                  <Clock className={cn("h-4 w-4 transition-transform group-hover:-rotate-12", scheduledAt ? "text-primary" : "text-foreground")} />
                  <span className="text-sm font-semibold max-w-[140px] truncate">{scheduleLabel}</span>
                  <ChevronDown className={cn("h-3.5 w-3.5 opacity-60 transition-transform", scheduleOpen && "rotate-180")} />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-3" align="start">
                {!showCustom ? (
                  <div className="space-y-1">
                    <button onClick={handleNow} className={cn("w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-between", !scheduledAt ? "bg-primary/10 text-primary" : "hover:bg-accent")}>
                      <span>{t("rider.pickupNow", "Pickup now")}</span>
                      {!scheduledAt && <Check className="h-4 w-4" />}
                    </button>
                    {[{ m: 15, label: "In 15 mins" }, { m: 30, label: "In 30 mins" }, { m: 60, label: "In 1 hour" }].map(({ m, label }) => (
                      <button key={m} onClick={() => handlePreset(m)} className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-accent transition-colors">
                        {label}
                      </button>
                    ))}
                    <button onClick={() => setShowCustom(true)} className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-accent transition-colors flex items-center gap-2">
                      <CalendarIcon className="h-3.5 w-3.5" />
                      Custom date &amp; time
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
                      <Input type="time" value={customTime} onChange={(e) => setCustomTime(e.target.value)} className="flex-1" />
                      <Button size="sm" onClick={handleCustomConfirm} disabled={!customDate}>
                        Set
                      </Button>
                    </div>
                    <button onClick={() => setShowCustom(false)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                      ← Back
                    </button>
                  </div>
                )}
              </PopoverContent>
            </Popover>

            <Popover open={riderOpen} onOpenChange={openRiderPopover}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "group flex items-center gap-2 rounded-full border px-3.5 py-2 transition-all active:scale-95",
                    riderMode === "other"
                      ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/15"
                      : "border-border/60 bg-secondary hover:bg-accent"
                  )}
                >
                  {riderMode === "other" ? (
                    <UserPlus className="h-4 w-4 text-primary" />
                  ) : (
                    <User className="h-4 w-4 text-foreground transition-transform group-hover:scale-110" />
                  )}
                  <span className="text-sm font-semibold max-w-[140px] truncate">{riderLabel}</span>
                  <ChevronDown className={cn("h-3.5 w-3.5 opacity-60 transition-transform", riderOpen && "rotate-180")} />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-3" align="start">
                <div className="space-y-1 mb-2">
                  <button
                    onClick={() => setDraftMode("me")}
                    className={cn(
                      "w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-between",
                      draftMode === "me" ? "bg-primary/10 text-primary" : "hover:bg-accent"
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      {t("rider.forMe", "For me")}
                    </span>
                    {draftMode === "me" && <Check className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => setDraftMode("other")}
                    className={cn(
                      "w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-between",
                      draftMode === "other" ? "bg-primary/10 text-primary" : "hover:bg-accent"
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <UserPlus className="h-4 w-4" />
                      {t("rider.forSomeoneElse", "For someone else")}
                    </span>
                    {draftMode === "other" && <Check className="h-4 w-4" />}
                  </button>
                </div>
                {draftMode === "other" && (
                  <div className="space-y-2 pt-2 border-t border-border/40">
                    <Input
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      placeholder={t("rider.contactName", "Rider name")}
                      className="h-9"
                    />
                    <Input
                      value={draftPhone}
                      onChange={(e) => setDraftPhone(e.target.value)}
                      placeholder={t("rider.contactPhone", "Phone number")}
                      type="tel"
                      className="h-9"
                    />
                  </div>
                )}
                <Button
                  size="sm"
                  className="w-full mt-3 rounded-full"
                  onClick={confirmRider}
                  disabled={draftMode === "other" && (!draftName.trim() || !draftPhone.trim())}
                >
                  {t("common.confirm", "Confirm")}
                </Button>
              </PopoverContent>
            </Popover>
          </div>

          {/* Address card */}
          <div className="rounded-2xl border border-border/60 bg-card p-3">
            {/* Pickup */}
            <div className="flex items-center gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center">
                <div className="h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-green-500/20" />
              </div>
              <div className="flex-1 [&_svg.absolute]:hidden [&_input]:border-0 [&_input]:bg-transparent [&_input]:shadow-none [&_input]:focus-visible:ring-0 [&_input]:focus-visible:ring-offset-0 [&_input]:text-[14px] [&_input]:font-semibold [&_input]:placeholder:text-muted-foreground [&_input]:h-9 [&_input]:px-0 [&_input]:pl-0">
                <AddressAutocomplete
                  value={pickupAddress}
                  onChange={(value, lat, lng) => {
                    setPickupAddress(value);
                    if (lat && lng) setPickupCoords({ lat, lng });
                  }}
                  placeholder={t("rider.pickupLocation", "Pickup location")}
                  iconColor="text-green-500"
                />
              </div>
              <button
                type="button"
                onClick={useMyLocation}
                className="shrink-0 text-primary hover:text-primary/80 transition-colors"
                aria-label={t("common.useMyLocation", "Use my location")}
              >
                <LocateFixed className="h-4 w-4" />
              </button>
            </div>

            {/* Connector */}
            <div className="ml-3 my-1 h-3 border-l-2 border-dashed border-border/60" />

            {/* Intermediate stops editor */}
            {setStops && (
              <div className="my-2">
                <RouteStopsEditor stops={stops ?? []} onChange={setStops} />
              </div>
            )}

            {/* Connector before dropoff */}
            <div className="ml-3 my-1 h-3 border-l-2 border-dashed border-border/60" />

            {/* Dropoff */}
            <div ref={dropoffRef} className="flex items-center gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center">
                <div className="h-2.5 w-2.5 rounded-sm bg-primary ring-2 ring-primary/20" />
              </div>
              <div className="flex-1 [&_svg.absolute]:hidden [&_input]:border-0 [&_input]:bg-transparent [&_input]:shadow-none [&_input]:focus-visible:ring-0 [&_input]:focus-visible:ring-offset-0 [&_input]:text-[14px] [&_input]:font-semibold [&_input]:placeholder:text-muted-foreground [&_input]:h-9 [&_input]:px-0 [&_input]:pl-0">
                <AddressAutocomplete
                  value={destination}
                  onChange={(value, lat, lng) => {
                    setDestination(value);
                    if (lat && lng) setDropoffCoords({ lat, lng });
                  }}
                  placeholder={t("dashboard.whereTo", "Where to?")}
                  iconColor="text-primary"
                />
              </div>
            </div>
          </div>

          {/* Helper rows */}
          <div className="divide-y divide-border/30 rounded-2xl border border-border/30 bg-card/40">
            <button
              type="button"
              onClick={() => {
                onOpenChange(false);
                onRequestMapPick?.();
              }}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-accent/30 transition-colors"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary">
                <MapIcon className="h-4 w-4 text-foreground" />
              </div>
              <span className="flex-1 text-[14px] font-semibold">
                {t("rider.setLocationOnMap", "Set location on map")}
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
            </button>

            {savedPlaces.length > 0 && (
              <div className="px-4 py-3.5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary">
                    <MapPin className="h-4 w-4 text-foreground" />
                  </div>
                  <span className="text-[14px] font-semibold">
                    {t("rider.savedPlaces", "Saved places")}
                  </span>
                </div>
                <SavedPlaceChips
                  places={savedPlaces}
                  selectedAddress={destination}
                  onSelect={(address, lat, lng) => {
                    setDestination(address);
                    if (lat && lng) setDropoffCoords({ lat, lng });
                    onOpenChange(false);
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Continue */}
        <div className="border-t border-border/30 px-4 py-3">
          <Button
            size="lg"
            className="w-full rounded-full"
            disabled={!canContinue}
            onClick={handleContinue}
          >
            {t("rider.continue", "Continue")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
