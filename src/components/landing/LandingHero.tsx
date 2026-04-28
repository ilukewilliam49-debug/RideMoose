import { forwardRef, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  ChevronDown,
  Navigation,
  Crosshair,
  Briefcase,
  Car,
  Clock,
  Loader2,
  MapPin,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  useRecentLocations,
  type RecentLocation,
  type RecentKind,
} from "@/hooks/useRecentLocations";
import PassengerCountPicker from "@/components/rider/PassengerCountPicker";
import { usePassengerCount } from "@/hooks/usePassengerCount";

const YellowknifeMap = lazy(() => import("./YellowknifeMap"));

export type LandingTab = "ride" | "drive" | "business";

const readTabFromHash = (): LandingTab => {
  if (typeof window === "undefined") return "ride";
  const h = window.location.hash.replace("#", "");
  if (h === "drive" || h === "business") return h;
  return "ride";
};

// ─────────────────────────────── Component ──────────────────────────────────

const LandingHero = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<LandingTab>(readTabFromHash);
  const pickupRef = useRef<HTMLInputElement>(null);
  // Submit-side writer — kind is overridden per call below.
  const { addRecent } = useRecentLocations("either");

  useEffect(() => {
    const onHash = () => setTab(readTabFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // Autofocus pickup on Ride tab — desktop only (avoid mobile keyboard pop)
  useEffect(() => {
    if (tab !== "ride") return;
    if (typeof window === "undefined") return;
    if (window.matchMedia("(min-width: 768px)").matches) {
      pickupRef.current?.focus();
    }
  }, [tab]);

  const handleBookingSubmit = useCallback(
    (pickup?: LocationValue, dropoff?: LocationValue, passengers?: number) => {
      // Persist any concrete selections as recent so they appear next visit.
      // Authenticated users sync via Supabase; guests fall back to localStorage.
      if (pickup?.description) {
        void addRecent(
          { description: pickup.description, lat: pickup.lat, lng: pickup.lng },
          "pickup"
        );
      }
      if (dropoff?.description) {
        void addRecent(
          { description: dropoff.description, lat: dropoff.lat, lng: dropoff.lng },
          "dropoff"
        );
      }

      // Pass selections through to the auth flow via query params; the
      // post-login redirect can hydrate the booking sheet from these.
      const params = new URLSearchParams();
      params.set("redirect", "/rider");
      if (pickup?.description) params.set("pickup", pickup.description);
      if (pickup?.lat != null && pickup?.lng != null) {
        params.set("pickupLat", String(pickup.lat));
        params.set("pickupLng", String(pickup.lng));
      }
      if (dropoff?.description) params.set("dropoff", dropoff.description);
      if (dropoff?.lat != null && dropoff?.lng != null) {
        params.set("dropoffLat", String(dropoff.lat));
        params.set("dropoffLng", String(dropoff.lng));
      }
      if (passengers && passengers > 0) {
        params.set("passengers", String(passengers));
      }
      navigate(`/login?${params.toString()}`);
    },
    [navigate, addRecent]
  );

  return (
    <section className="relative">
      {/* ── Hero headline band — sits above the map on every breakpoint ── */}
      <div className="border-b border-border/40 bg-background">
        <div className="mx-auto max-w-7xl px-4 py-6 text-center sm:px-5 md:py-10 lg:px-8 lg:text-left">
          <h1 className="text-balance text-2xl font-black tracking-tight text-foreground sm:text-3xl md:text-4xl lg:text-5xl">
            Your Ride. Your Choice.{" "}
            <span className="text-primary">
              Yellowknife&rsquo;s Premier Taxi &amp; Courier App.
            </span>
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base lg:mx-0">
            Book a metered taxi or independent PickYou driver in seconds — or
            send a courier across town. Local, fast, and fair.
          </p>
        </div>
      </div>

      {/* ── Mobile layout: stacked (map on top, booking card below) ──
          The map gets a bounded height so it stays fully visible, and the
          card flows in normal document flow underneath it instead of being
          absolutely positioned over the map. */}
      <div className="md:hidden">
        <div className="relative h-[42vh] min-h-[300px] max-h-[420px] w-full overflow-hidden">
          <Suspense fallback={<div className="h-full w-full animate-pulse bg-muted" />}>
            <YellowknifeMap className="h-full w-full" />
          </Suspense>
          {/* Soft fade so the card edge feels connected to the map */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background/80 to-transparent" />
        </div>

        <div className="-mt-4 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
          <AnimatePresence mode="wait">
            {tab === "ride" && (
              <RideCard
                key="ride-mobile"
                pickupRef={pickupRef}
                onSubmit={handleBookingSubmit}
              />
            )}
            {tab === "drive" && (
              <DriveCard key="drive-mobile" onSubmit={() => navigate("/drive")} />
            )}
            {tab === "business" && (
              <BusinessCard key="business-mobile" onSubmit={() => navigate("/business")} />
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Desktop / tablet layout: full-bleed map with overlay card ── */}
      <div className="relative hidden h-[calc(100vh-5rem)] min-h-[600px] w-full overflow-hidden md:block">
        <Suspense fallback={<div className="h-full w-full animate-pulse bg-muted" />}>
          <YellowknifeMap className="h-full w-full" />
        </Suspense>

        <div className="pointer-events-none absolute inset-y-0 left-8 z-[500] flex items-center lg:left-12">
          <div className="pointer-events-auto w-full max-w-md">
            <AnimatePresence mode="wait">
              {tab === "ride" && (
                <RideCard
                  key="ride-desktop"
                  pickupRef={pickupRef}
                  onSubmit={handleBookingSubmit}
                />
              )}
              {tab === "drive" && (
                <DriveCard key="drive-desktop" onSubmit={() => navigate("/drive")} />
              )}
              {tab === "business" && (
                <BusinessCard key="business-desktop" onSubmit={() => navigate("/business")} />
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
};

// ───────────────────────────── Cards ─────────────────────────────

const cardMotion = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 8 },
  transition: { duration: 0.25, ease: "easeOut" as const },
};

type LocationValue = {
  description: string;
  lat?: number;
  lng?: number;
};

type RideCardProps = {
  pickupRef: React.RefObject<HTMLInputElement>;
  onSubmit: (pickup?: LocationValue, dropoff?: LocationValue, passengers?: number) => void;
};

const VAN_SURCHARGE = 6.0;

const RideCard = ({ pickupRef, onSubmit }: RideCardProps) => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [pickup, setPickup] = useState<LocationValue>({ description: "" });
  const [dropoff, setDropoff] = useState<LocationValue>({ description: "" });
  const [passengers, setPassengers] = usePassengerCount(1);
  const [clampNotice, setClampNotice] = useState<{ original: string; clamped: number } | null>(null);

  // Hydrate from ?passengers= on mount + back/forward; clamp invalid values.
  useEffect(() => {
    const raw = searchParams.get("passengers");
    if (raw === null) return;
    const trimmed = raw.trim();
    const isInt = /^-?\d+$/.test(trimmed);
    const parsed = parseInt(trimmed, 10);
    const valid = isInt && Number.isFinite(parsed) && parsed >= 1 && parsed <= 6;
    if (valid) {
      if (parsed !== passengers) setPassengers(parsed);
      setClampNotice(null);
    } else {
      const clamped = isInt && Number.isFinite(parsed)
        ? Math.min(6, Math.max(1, parsed))
        : 1;
      setPassengers(clamped);
      setClampNotice({ original: raw, clamped });
      const params = new URLSearchParams(searchParams);
      params.set("passengers", String(clamped));
      setSearchParams(params, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Sync URL from state when user changes the picker (only if param already present,
  // to avoid polluting the homepage URL for users who didn't deep-link).
  useEffect(() => {
    const current = searchParams.get("passengers");
    if (current === null) return;
    if (current === String(passengers)) return;
    const params = new URLSearchParams(searchParams);
    params.set("passengers", String(passengers));
    setSearchParams(params, { replace: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passengers]);

  const submit = () => onSubmit(pickup, dropoff, passengers);

  return (
    <motion.div
      {...cardMotion}
      className="rounded-3xl bg-card/95 p-4 shadow-2xl ring-1 ring-border/40 backdrop-blur-xl md:p-6"
    >
      <h2 className="mb-3 text-xl font-black tracking-tight md:mb-4 md:text-2xl">
        {t("landing.getRideTitle", "Get a ride")}
      </h2>

      <div className="space-y-2">
        <LocationInput
          ref={pickupRef}
          value={pickup}
          onChange={setPickup}
          kind="pickup"
          placeholder={t("rider.searchPickup", "Pickup location")}
          dotKind="circle"
          trailing={
            <button
              type="button"
              onClick={submit}
              aria-label={t("landing.currentLocation", "Current location")}
              className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground"
            >
              <Crosshair className="h-4 w-4" />
            </button>
          }
        />

        <LocationInput
          value={dropoff}
          onChange={setDropoff}
          kind="dropoff"
          placeholder={t("rider.searchDropoff", "Dropoff location")}
          dotKind="square"
          trailing={
            <Navigation
              className="ml-auto h-4 w-4 shrink-0 text-muted-foreground/50"
              aria-hidden
            />
          }
        />
      </div>

      <div className="mt-4">
        <PassengerCountPicker value={passengers} onChange={setPassengers} max={6} />
        {clampNotice && (
          <p
            role="status"
            aria-live="polite"
            className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-700 dark:text-amber-300"
          >
            {t(
              "landing.passengersClamped",
              `Passenger count "${clampNotice.original}" is out of range. Adjusted to ${clampNotice.clamped} (allowed 1–6).`
            )}
          </p>
        )}
        {passengers >= 5 && (
          <p className="mt-2 text-[11px] text-amber-600">
            {t(
              "landing.vanSurchargeNote",
              `Van price applied: +$${VAN_SURCHARGE.toFixed(2)} for groups of 5–6.`
            )}
          </p>
        )}
      </div>


      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={submit}
          className="flex items-center justify-between gap-2 rounded-xl bg-muted/60 px-3.5 py-2.5 text-left text-xs font-semibold transition hover:bg-muted"
        >
          <span className="truncate">{t("rider.pickupNow", "Pickup now")}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        <button
          type="button"
          onClick={submit}
          className="flex items-center justify-between gap-2 rounded-xl bg-muted/60 px-3.5 py-2.5 text-left text-xs font-semibold transition hover:bg-muted"
        >
          <span className="truncate">{t("rider.forMe", "For me")}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>

      <Button
        size="lg"
        onClick={submit}
        className="mt-4 h-12 w-full rounded-xl text-sm font-bold"
      >
        {t("landing.requestRide")}
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </motion.div>
  );
};

// ────────────────── Smart location input with suggestions ───────────────────

type Prediction = { description: string; place_id: string };

type LocationInputProps = {
  value: LocationValue;
  onChange: (next: LocationValue) => void;
  kind: RecentKind;
  placeholder?: string;
  dotKind: "circle" | "square";
  trailing?: React.ReactNode;
};

const LocationInput = forwardRef<HTMLInputElement, LocationInputProps>(({
  value,
  onChange,
  kind,
  placeholder,
  dotKind,
  trailing,
}, forwardedRef) => {
  const { t } = useTranslation();
  const [suggestions, setSuggestions] = useState<Prediction[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { recents, addRecent } = useRecentLocations(kind);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);
  const reqIdRef = useRef(0);

  const showRecents = useMemo(
    () => value.description.trim().length === 0 && recents.length > 0,
    [value.description, recents.length]
  );

  const search = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 3) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    const myReq = ++reqIdRef.current;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("places-autocomplete", {
        body: { input: trimmed },
      });
      if (myReq !== reqIdRef.current) return; // outdated
      if (error) throw error;
      const predictions: Prediction[] = data?.predictions || [];
      setSuggestions(predictions);
      setOpen(true);
    } catch {
      if (myReq !== reqIdRef.current) return;
      setSuggestions([]);
    } finally {
      if (myReq === reqIdRef.current) setLoading(false);
    }
  }, []);

  const handleType = (text: string) => {
    onChange({ description: text, lat: undefined, lng: undefined });
    setOpen(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(text), 350);
  };

  const handleSelectPrediction = async (prediction: Prediction) => {
    setOpen(false);
    setSuggestions([]);
    onChange({ description: prediction.description });
    try {
      const { data, error } = await supabase.functions.invoke("place-details", {
        body: { place_id: prediction.place_id },
      });
      if (error) throw error;
      if (data?.lat && data?.lng) {
        const shortName =
          data.name ||
          prediction.description.split(",").slice(0, 2).join(",").trim();
        const next: LocationValue = {
          description: shortName,
          lat: data.lat,
          lng: data.lng,
        };
        onChange(next);
        void addRecent(next);
      }
    } catch {
      /* ignore — keep typed description */
    }
  };

  const handleSelectRecent = (r: RecentLocation) => {
    setOpen(false);
    onChange({ description: r.description, lat: r.lat, lng: r.lng });
    void addRecent({ description: r.description, lat: r.lat, lng: r.lng });
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleFocus = () => {
    setOpen(true);
  };

  const dropdownVisible =
    open && (suggestions.length > 0 || loading || showRecents);

  return (
    <div ref={containerRef} className="relative">
      <div className="group relative flex items-center gap-3 rounded-2xl bg-muted/60 px-4 py-3.5 ring-1 ring-transparent transition focus-within:bg-muted focus-within:ring-primary/40">
        <span
          className={cn(
            "flex h-2.5 w-2.5 shrink-0",
            dotKind === "circle" ? "rounded-full bg-foreground" : "rounded-sm bg-primary"
          )}
          aria-hidden
        />
        <input
          ref={forwardedRef}
          type="text"
          value={value.description}
          placeholder={placeholder}
          onChange={(e) => handleType(e.target.value)}
          onFocus={handleFocus}
          autoComplete="off"
          className="w-full bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        {loading ? (
          <Loader2 className="ml-auto h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
        ) : (
          trailing
        )}
      </div>

      <AnimatePresence>
        {dropdownVisible && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute left-0 right-0 z-[1200] mt-1.5 max-h-72 overflow-y-auto rounded-2xl border border-border/60 bg-popover/95 p-1 shadow-xl backdrop-blur-xl"
          >
            {showRecents && (
              <>
                <div className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {t("landing.recentLocations", "Recent")}
                </div>
                {recents.map((r) => (
                  <button
                    key={`${r.description}-${r.ts}`}
                    type="button"
                    onClick={() => handleSelectRecent(r)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition hover:bg-accent"
                  >
                    <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{r.description}</span>
                  </button>
                ))}
              </>
            )}

            {suggestions.length > 0 && (
              <>
                {showRecents && <div className="my-1 h-px bg-border/60" />}
                {suggestions.map((s) => (
                  <button
                    key={s.place_id}
                    type="button"
                    onClick={() => handleSelectPrediction(s)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition hover:bg-accent"
                  >
                    <MapPin className="h-4 w-4 shrink-0 text-primary" />
                    <span className="truncate">{s.description}</span>
                  </button>
                ))}
              </>
            )}

            {!loading && suggestions.length === 0 && !showRecents && value.description.trim().length >= 3 && (
              <div className="px-3 py-3 text-center text-xs text-muted-foreground">
                {t("landing.noSuggestions", "No matches yet — keep typing")}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
LocationInput.displayName = "LocationInput";

// ────────────────────────── Other tab cards ────────────────────────────────

const DriveCard = ({ onSubmit }: { onSubmit: () => void }) => {
  const { t } = useTranslation();
  return (
    <motion.div
      {...cardMotion}
      className="rounded-3xl bg-card/95 p-6 shadow-2xl ring-1 ring-border/40 backdrop-blur-xl"
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
        <Car className="h-5 w-5 text-primary" />
      </div>
      <h2 className="text-xl font-black tracking-tight md:text-2xl">
        {t("landing.earnTitle", "Earn with PickYou")}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {t("landing.earnDesc", "Drive on your own schedule. Keep more with low commission.")}
      </p>
      <Button size="lg" onClick={onSubmit} className="mt-5 h-12 w-full rounded-xl text-sm font-bold">
        {t("landing.startDriving", "Start driving")}
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </motion.div>
  );
};

const BusinessCard = ({ onSubmit }: { onSubmit: () => void }) => {
  const { t } = useTranslation();
  return (
    <motion.div
      {...cardMotion}
      className="rounded-3xl bg-card/95 p-6 shadow-2xl ring-1 ring-border/40 backdrop-blur-xl"
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
        <Briefcase className="h-5 w-5 text-primary" />
      </div>
      <h2 className="text-xl font-black tracking-tight md:text-2xl">
        {t("landing.businessCardTitle", "Business rides & accounts")}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {t("landing.businessCardDesc", "One account for your whole team. Monthly billing, full visibility.")}
      </p>
      <Button size="lg" onClick={onSubmit} className="mt-5 h-12 w-full rounded-xl text-sm font-bold">
        {t("landing.businessGetStarted", "Get started")}
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </motion.div>
  );
};

export default LandingHero;
