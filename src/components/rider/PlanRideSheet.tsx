import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, MapPin, LocateFixed, Map as MapIcon, ChevronRight } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import AddressAutocomplete from "@/components/map/AddressAutocomplete";
import SavedPlaceChips from "@/components/rider/SavedPlaceChips";
import RouteStopsEditor from "@/components/rider/RouteStopsEditor";
import PickupTimeSelector from "@/components/rider/PickupTimeSelector";
import RiderSelector from "@/components/rider/RiderSelector";
import { useRideBooking } from "@/contexts/RideBookingContext";
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
  setUserLocation,
  savedPlaces = [],
  onRequestMapPick,
  stops,
  setStops,
}: PlanRideSheetProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dropoffRef = useRef<HTMLDivElement>(null);

  const { scheduledAt, bookingFor, guestName, guestPhone } = useRideBooking();

  // Autofocus the dropoff input when sheet opens
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => {
      const input = dropoffRef.current?.querySelector("input");
      input?.focus();
    }, 250);
    return () => clearTimeout(id);
  }, [open]);

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
    const params = new URLSearchParams();
    if (pickupAddress && pickupCoords) {
      params.set("pickup", pickupAddress);
      params.set("plat", String(pickupCoords.lat));
      params.set("plng", String(pickupCoords.lng));
    }
    if (destination && dropoffCoords) {
      params.set("dropoff", destination);
      params.set("dlat", String(dropoffCoords.lat));
      params.set("dlng", String(dropoffCoords.lng));
    }
    if (stops && stops.length > 0) {
      const validStops = stops.filter((s) => s.address && s.lat && s.lng);
      if (validStops.length > 0) {
        params.set("stops", encodeStopsParam(validStops));
      }
    }
    if (scheduledAt) {
      params.set("scheduledAt", scheduledAt.toISOString());
    }
    if (bookingFor === "guest" && guestName && guestPhone) {
      params.set("bookingFor", "guest");
      params.set("guestName", guestName);
      params.set("guestPhone", guestPhone);
    }
    onOpenChange(false);
    const qs = params.toString();
    navigate(qs ? `${base}?${qs}` : base);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[100dvh] w-full max-w-full p-0 rounded-t-2xl flex flex-col gap-0 border-0 sm:max-w-full"
        onPointerDownOutside={(e) => {
          // Prevent sheet from closing when interacting with portaled popovers
          // (PickupTimeSelector / RiderSelector live in a portal outside this sheet).
          const target = e.target as HTMLElement | null;
          if (target?.closest?.("[data-radix-popper-content-wrapper]")) {
            e.preventDefault();
          }
        }}
        onInteractOutside={(e) => {
          const target = e.target as HTMLElement | null;
          if (target?.closest?.("[data-radix-popper-content-wrapper]")) {
            e.preventDefault();
          }
        }}
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
          {/* Chip row — modular Uber-style action pills */}
          <div className="flex items-center gap-2">
            <PickupTimeSelector />
            <RiderSelector />
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
                    else setPickupCoords(null);
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
                    else setDropoffCoords(null);
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
