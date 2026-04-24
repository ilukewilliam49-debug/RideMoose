import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import InstallAppPrompt from "@/components/InstallAppPrompt";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  CalendarClock,
  CalendarIcon,
  Car,
  ChevronDown,
  HelpCircle,
  LocateFixed,
  MapPin,
  Pencil,
  Phone,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import LandingNav from "@/components/landing/LandingNav";
import LandingHero, { type LandingTab } from "@/components/landing/LandingHero";
import LandingDriver from "@/components/landing/LandingDriver";
import LandingFooter from "@/components/landing/LandingFooter";
import RideMap from "@/components/map/MapContainer";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useActiveRole } from "@/contexts/ActiveRoleContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { resolvePostAuthRoute, clearRoleIntentFromUrl } from "@/lib/post-auth-route";

const readTabFromHash = (): LandingTab => {
  if (typeof window === "undefined") return "ride";
  const h = window.location.hash.replace("#", "");
  if (h === "drive" || h === "business") return h;
  return "ride";
};

const Index = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { user, profile, loading } = useAuth();
  const { activeRole } = useActiveRole();
  const isMobile = useIsMobile();
  const showPublicLanding = new URLSearchParams(location.search).get("view") === "landing";
  const [tab, setTab] = useState<LandingTab>(readTabFromHash);
  // Controls the mobile bottom-sheet "More" drawer on the Ride tab. The
  // map + booking card stay fully interactive underneath.
  const [moreOpen, setMoreOpen] = useState(false);
  // The sheet has two views: the menu of quick actions, and a schedule-ride
  // form. Tapping "Schedule a ride" swaps to the form without closing the sheet.
  const [sheetView, setSheetView] = useState<"menu" | "schedule">("menu");

  useEffect(() => {
    const onHash = () => setTab(readTabFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // Always close the mobile bottom sheet when switching tabs.
  useEffect(() => {
    setMoreOpen(false);
  }, [tab]);

  // When the sheet closes, reset back to the menu view so the next open
  // shows the menu, not a half-filled schedule form.
  useEffect(() => {
    if (!moreOpen) setSheetView("menu");
  }, [moreOpen]);

  useEffect(() => {
    if (loading || !user || showPublicLanding) return;
    const params = new URLSearchParams(location.search);
    const intent = params.get("intent");
    const returnTo = params.get("returnTo");
    const route = resolvePostAuthRoute(profile as any, { intent, activeRole, returnTo });
    clearRoleIntentFromUrl();
    navigate(route, { replace: true });
  }, [user, profile, loading, navigate, showPublicLanding, activeRole, location.search]);

  if (loading || (user && !showPublicLanding)) return null;

  // Driver recruitment + bottom CTA appear ONLY when the Drive tab is active,
  // on every breakpoint. They must never render under Ride or Business.
  const showDriverContent = tab === "drive";
  // Footer is hidden on the mobile Ride tab (the bottom sheet provides
  // navigation instead). Drive and Business tabs always show the footer.
  const showFooter = !isMobile || tab !== "ride";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <InstallAppPrompt />
      <LandingNav />
      <LandingHero />

      {/* Mobile-only "More" trigger + bottom-sheet drawer. Visible only on
          the Ride tab so it never competes with Drive / Business content. */}
      {isMobile && tab === "ride" && (
        <Drawer open={moreOpen} onOpenChange={setMoreOpen}>
          <div className="flex justify-center border-t border-border/30 bg-background px-5 py-4 md:hidden">
            <DrawerTrigger asChild>
              <button
                type="button"
                aria-label={t("landing.exploreMore", "Explore PickYou")}
                className="inline-flex items-center gap-2 rounded-full bg-muted/70 px-5 py-2.5 text-xs font-bold text-foreground ring-1 ring-border/40 transition active:scale-[0.98]"
              >
                {t("landing.exploreMore", "Explore PickYou")}
                <ChevronDown className="h-4 w-4" />
              </button>
            </DrawerTrigger>
          </div>

          <DrawerContent className="md:hidden">
            {sheetView === "menu" ? (
              <>
                <DrawerHeader className="text-left">
                  <DrawerTitle>{t("landing.moreSheetTitle", "More options")}</DrawerTitle>
                  <DrawerDescription>
                    {t("landing.moreSheetDesc", "Quick links to other PickYou services and support.")}
                  </DrawerDescription>
                </DrawerHeader>

                <div className="grid grid-cols-2 gap-3 px-4 pb-2">
                  <SheetAction
                    icon={CalendarClock}
                    label={t("rider.scheduleRide", "Schedule a ride")}
                    onSelect={() => setSheetView("schedule")}
                  />
                  <SheetAction
                    icon={Car}
                    label={t("nav.drive", "Drive")}
                    onSelect={() => {
                      setMoreOpen(false);
                      if (typeof window !== "undefined") window.location.hash = "drive";
                    }}
                  />
                  <SheetAction
                    icon={Briefcase}
                    label={t("nav.business", "Business")}
                    onSelect={() => {
                      setMoreOpen(false);
                      if (typeof window !== "undefined") window.location.hash = "business";
                    }}
                  />
                  <SheetAction
                    icon={HelpCircle}
                    label={t("landing.moreSheetHelp", "Help & support")}
                    onSelect={() => {
                      setMoreOpen(false);
                      window.location.href = "tel:+18679888836";
                    }}
                  />
                </div>

                <div className="space-y-2 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3">
                  <Button
                    size="lg"
                    className="h-12 w-full rounded-xl text-sm font-bold"
                    onClick={() => {
                      setMoreOpen(false);
                      navigate("/login");
                    }}
                  >
                    {t("nav.signUp", "Sign up")}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                  <a
                    href="tel:+18679888836"
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-muted text-sm font-bold text-foreground transition active:scale-[0.99]"
                  >
                    <Phone className="h-4 w-4" />
                    {t("landing.callNow", "Call now")}
                  </a>
                  <DrawerClose asChild>
                    <button
                      type="button"
                      className="mt-1 flex h-10 w-full items-center justify-center text-xs font-semibold text-muted-foreground"
                    >
                      {t("common.close", "Close")}
                    </button>
                  </DrawerClose>
                </div>
              </>
            ) : (
              <ScheduleRideForm
                onBack={() => setSheetView("menu")}
                onSubmit={({ scheduledAt, pickup }) => {
                  setMoreOpen(false);
                  // Build the post-auth target: /rider with prefilled pickup
                  // (when geolocation succeeded) and the scheduled timestamp.
                  // useRideBookingState reads `pickup`, `plat`, `plng`, and
                  // RiderDashboard reads `scheduledAt` from the URL.
                  const riderParams = new URLSearchParams();
                  riderParams.set("scheduledAt", scheduledAt.toISOString());
                  if (pickup) {
                    riderParams.set("pickup", pickup.address);
                    if (pickup.lat != null && pickup.lng != null) {
                      riderParams.set("plat", String(pickup.lat));
                      riderParams.set("plng", String(pickup.lng));
                    }
                  }
                  const returnTo = `/rider?${riderParams.toString()}`;

                  const loginParams = new URLSearchParams();
                  loginParams.set("intent", "rider");
                  loginParams.set("returnTo", returnTo);
                  navigate(`/login?${loginParams.toString()}`);
                }}
              />
            )}
          </DrawerContent>
        </Drawer>
      )}

      {/* Drive tab: driver recruitment + bottom CTA. Strictly gated — never
          rendered on Ride or Business, on any breakpoint. */}
      {showDriverContent && (
        <div id="drive-tab-panel">
          <LandingDriver />

          {/* ── Bottom CTA ── */}
          <section className="border-t border-border/30 px-5 lg:px-8 py-14 md:py-20">
            <div className="mx-auto max-w-7xl">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4 }}
                className="space-y-5"
              >
                <h2 className="text-2xl font-black tracking-tight md:text-4xl md:max-w-2xl">
                  {t("landing.ctaTitle")}
                </h2>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    size="lg"
                    className="h-12 rounded-xl px-7 text-sm font-bold"
                    onClick={() => navigate("/login")}
                  >
                    {t("landing.requestRide")}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                  <Button
                    size="lg"
                    variant="secondary"
                    className="h-12 rounded-xl px-7 text-sm font-bold"
                    onClick={() => (window.location.href = "tel:+18679888836")}
                  >
                    <Phone className="mr-2 h-4 w-4" />
                    {t("landing.callNow")}
                  </Button>
                </div>
              </motion.div>
            </div>
          </section>
        </div>
      )}

      {showFooter && <LandingFooter />}
    </div>
  );
};

// ───────────────────────────────────────────────────────────────────
// Bottom-sheet quick action — square chip with icon + label
// ───────────────────────────────────────────────────────────────────

type SheetActionProps = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onSelect: () => void;
};

const SheetAction = ({ icon: Icon, label, onSelect }: SheetActionProps) => (
  <button
    type="button"
    onClick={onSelect}
    className="flex flex-col items-start gap-3 rounded-2xl bg-muted/60 p-4 text-left ring-1 ring-border/30 transition active:scale-[0.98]"
  >
    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
      <Icon className="h-5 w-5 text-primary" />
    </span>
    <span className="text-sm font-bold leading-tight">{label}</span>
  </button>
);

// ───────────────────────────────────────────────────────────────────
// Schedule-a-ride form — date picker + time field, validates the
// combined value is in the future before handing off to the login flow.
// ───────────────────────────────────────────────────────────────────

type SchedulePickup = {
  address: string;
  lat?: number | null;
  lng?: number | null;
};

type ScheduleSubmitPayload = {
  scheduledAt: Date;
  pickup: SchedulePickup | null;
};

type ScheduleRideFormProps = {
  onBack: () => void;
  onSubmit: (payload: ScheduleSubmitPayload) => void;
};

const ScheduleRideForm = ({ onBack, onSubmit }: ScheduleRideFormProps) => {
  const { t } = useTranslation();
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [time, setTime] = useState<string>(() => {
    // Default to ~30 min from now, rounded to the next 15 minutes.
    const d = new Date(Date.now() + 30 * 60 * 1000);
    const m = d.getMinutes();
    d.setMinutes(m + ((15 - (m % 15)) % 15), 0, 0);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  });
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Pickup prefill state. We try geolocation in the background so the user
  // doesn't have to re-enter pickup after authenticating. Failure is
  // non-blocking — the rider screen will fall back to its own geolocate.
  const [pickup, setPickup] = useState<SchedulePickup | null>(null);
  const [pickupStatus, setPickupStatus] = useState<"idle" | "locating" | "ready" | "edited" | "cleared" | "denied">("idle");

  // Geolocate the user and reverse-geocode into an address. Used both on
  // mount (auto-prefill) and via the "Use current location" button after
  // the user clears or edits the field.
  const requestCurrentLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setPickupStatus("denied");
      return () => {};
    }
    let cancelled = false;
    setPickupStatus("locating");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        if (cancelled) return;
        const { latitude, longitude } = pos.coords;
        let address = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
          );
          const geo = await res.json();
          if (geo?.display_name) address = geo.display_name;
        } catch {
          /* keep coord-string fallback */
        }
        if (cancelled) return;
        setPickup({ address, lat: latitude, lng: longitude });
        setPickupStatus("ready");
      },
      () => {
        if (!cancelled) setPickupStatus("denied");
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const cancel = requestCurrentLocation();
    return () => cancel();
  }, [requestCurrentLocation]);

  // Update the pickup address from typed input. We drop the lat/lng coords
  // because they no longer match the (potentially edited) address — the
  // rider page will geocode the typed value after login if needed.
  const handlePickupChange = useCallback((value: string) => {
    setPickup({ address: value, lat: null, lng: null });
    setPickupStatus(value.trim().length > 0 ? "edited" : "cleared");
  }, []);

  const handlePickupClear = useCallback(() => {
    setPickup(null);
    setPickupStatus("cleared");
  }, []);

  // Only forward a pickup payload to the login flow if the user actually
  // has an address. An all-whitespace value is treated as cleared.
  const pickupForSubmit = useMemo<SchedulePickup | null>(() => {
    if (!pickup) return null;
    const trimmed = pickup.address.trim();
    if (!trimmed) return null;
    return { address: trimmed, lat: pickup.lat ?? null, lng: pickup.lng ?? null };
  }, [pickup]);

  // Combine date + time into a single Date, or null if either is missing
  // or the combined moment is not at least 5 min in the future.
  const combined = useMemo(() => {
    if (!date) return null;
    const [hh, mm] = time.split(":").map(Number);
    if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
    const d = new Date(date);
    d.setHours(hh, mm, 0, 0);
    return d;
  }, [date, time]);

  const minScheduleTime = Date.now() + 5 * 60 * 1000; // 5 min in the future
  const valid = combined != null && combined.getTime() >= minScheduleTime;

  return (
    <div className="px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
      <DrawerHeader className="px-0 text-left">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            aria-label={t("common.back", "Back")}
            className="-ml-2 flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted active:scale-95"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <DrawerTitle>{t("rider.scheduleRide", "Schedule a ride")}</DrawerTitle>
        </div>
        <DrawerDescription>
          {t(
            "landing.scheduleSheetDesc",
            "Pick a date and time. We'll match you with a driver shortly before pickup.",
          )}
        </DrawerDescription>
      </DrawerHeader>

      <div className="space-y-3 pt-2">
        <div className="space-y-1.5">
          <label
            htmlFor="schedule-date"
            className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
          >
            {t("landing.scheduleDateLabel", "Date")}
          </label>
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                id="schedule-date"
                type="button"
                variant="outline"
                className={cn(
                  "h-12 w-full justify-start rounded-xl text-left text-sm font-semibold",
                  !date && "text-muted-foreground",
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date ? format(date, "PPP") : t("landing.schedulePickDate", "Pick a date")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(d) => {
                  setDate(d);
                  setCalendarOpen(false);
                }}
                disabled={(d) => {
                  // Only allow today and the next 30 days
                  const start = new Date();
                  start.setHours(0, 0, 0, 0);
                  const end = new Date(start);
                  end.setDate(end.getDate() + 30);
                  return d < start || d > end;
                }}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="schedule-time"
            className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
          >
            {t("landing.scheduleTimeLabel", "Time")}
          </label>
          <input
            id="schedule-time"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            step={300}
            className="h-12 w-full rounded-xl border border-input bg-background px-4 text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {combined != null && !valid && (
          <p className="text-xs font-semibold text-destructive">
            {t("landing.scheduleInvalid", "Please pick a time at least 5 minutes from now.")}
          </p>
        )}

        {/* Editable pickup field — auto-prefilled from geolocation, but the
            user can clear, edit, or re-detect it before continuing. */}
        <div className="space-y-1.5">
          <label
            htmlFor="schedule-pickup"
            className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
          >
            {t("landing.schedulePickupReady", "Pickup")}
          </label>
          <div className="relative">
            <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="schedule-pickup"
              type="text"
              value={pickup?.address ?? ""}
              onChange={(e) => handlePickupChange(e.target.value)}
              placeholder={
                pickupStatus === "locating"
                  ? t("landing.schedulePickupLocating", "Detecting your pickup location…")
                  : t("landing.schedulePickupPlaceholder", "Enter pickup address")
              }
              className="h-12 w-full rounded-xl border border-input bg-background pl-9 pr-10 text-sm font-semibold text-foreground placeholder:font-medium placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {pickup?.address && (
              <button
                type="button"
                onClick={handlePickupClear}
                aria-label={t("landing.schedulePickupClear", "Clear pickup")}
                className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted active:scale-95"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground">
              {pickupStatus === "denied" &&
                t(
                  "landing.schedulePickupDenied",
                  "We'll ask for your pickup after login.",
                )}
              {pickupStatus === "edited" &&
                t(
                  "landing.schedulePickupEdited",
                  "Custom address — we'll confirm it after login.",
                )}
              {pickupStatus === "cleared" &&
                t(
                  "landing.schedulePickupCleared",
                  "Pickup cleared.",
                )}
            </p>
            {pickupStatus !== "ready" && pickupStatus !== "locating" && (
              <button
                type="button"
                onClick={requestCurrentLocation}
                className="inline-flex items-center gap-1 text-xs font-bold text-primary transition hover:underline"
              >
                <LocateFixed className="h-3.5 w-3.5" />
                {t("landing.schedulePickupUseCurrent", "Use current location")}
              </button>
            )}
          </div>

          {/* Tiny non-interactive map preview that confirms the pin
              location for the resolved pickup coordinates. */}
          {pickup?.lat != null && pickup?.lng != null && (
            <div className="space-y-2">
              <div className="overflow-hidden rounded-xl border border-border [&>div]:!h-[140px] [&>div]:!rounded-none [&>div]:!border-0">
                <RideMap
                  markers={[
                    {
                      lat: pickup.lat,
                      lng: pickup.lng,
                      type: "pickup",
                      label: pickup.address,
                    },
                  ]}
                  center={[pickup.lat, pickup.lng]}
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById("schedule-pickup") as HTMLInputElement | null;
                  if (!el) return;
                  el.scrollIntoView({ behavior: "smooth", block: "center" });
                  // Defer focus until after smooth scroll begins so iOS keyboards behave
                  window.setTimeout(() => {
                    el.focus();
                    el.select();
                  }, 250);
                }}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-primary transition hover:underline"
              >
                <Pencil className="h-3.5 w-3.5" />
                {t("landing.scheduleEditPickup", "Edit pickup")}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2 pt-4">
        <Button
          type="button"
          size="lg"
          disabled={!valid}
          onClick={() =>
            valid && combined && onSubmit({ scheduledAt: combined, pickup: pickupForSubmit })
          }
          className="h-12 w-full rounded-xl text-sm font-bold"
        >
          {t("landing.scheduleContinue", "Continue to login")}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
        <DrawerClose asChild>
          <button
            type="button"
            className="mt-1 flex h-10 w-full items-center justify-center text-xs font-semibold text-muted-foreground"
          >
            {t("common.close", "Close")}
          </button>
        </DrawerClose>
      </div>
    </div>
  );
};

export default Index;
