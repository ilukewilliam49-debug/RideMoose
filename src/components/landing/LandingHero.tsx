import { forwardRef, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
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

const YellowknifeMap = lazy(() => import("./YellowknifeMap"));

export type LandingTab = "ride" | "drive" | "business";

const readTabFromHash = (): LandingTab => {
  if (typeof window === "undefined") return "ride";
  const h = window.location.hash.replace("#", "");
  if (h === "drive" || h === "business") return h;
  return "ride";
};

// ─────────────── Recent locations (localStorage, per-browser) ───────────────

type RecentLocation = {
  description: string;
  lat?: number;
  lng?: number;
  ts: number;
};

const RECENTS_KEY = "pickyou:recent_locations";
const MAX_RECENTS = 6;

const readRecents = (): RecentLocation[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r) => r && typeof r.description === "string" && typeof r.ts === "number"
    );
  } catch {
    return [];
  }
};

const writeRecents = (entry: RecentLocation) => {
  if (typeof window === "undefined") return;
  try {
    const current = readRecents();
    const deduped = current.filter(
      (r) => r.description.toLowerCase() !== entry.description.toLowerCase()
    );
    const next = [entry, ...deduped].slice(0, MAX_RECENTS);
    window.localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota errors */
  }
};

// ─────────────────────────────── Component ──────────────────────────────────

const LandingHero = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<LandingTab>(readTabFromHash);
  const pickupRef = useRef<HTMLInputElement>(null);

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
    (pickup?: LocationValue, dropoff?: LocationValue) => {
      // Persist any concrete selections as recent so they appear next visit
      if (pickup?.description) {
        writeRecents({
          description: pickup.description,
          lat: pickup.lat,
          lng: pickup.lng,
          ts: Date.now(),
        });
      }
      if (dropoff?.description) {
        writeRecents({
          description: dropoff.description,
          lat: dropoff.lat,
          lng: dropoff.lng,
          ts: Date.now(),
        });
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
      navigate(`/login?${params.toString()}`);
    },
    [navigate]
  );

  return (
    <section className="relative">
      <div className="relative h-[calc(100vh-9rem)] min-h-[520px] w-full overflow-hidden md:h-[calc(100vh-5rem)] md:min-h-[600px]">
        <Suspense fallback={<div className="h-full w-full animate-pulse bg-muted" />}>
          <YellowknifeMap className="h-full w-full" />
        </Suspense>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-background/70 to-transparent md:hidden" />

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[500] flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] md:inset-y-0 md:right-auto md:left-8 md:items-center md:justify-start md:px-0 md:pb-0 lg:left-12">
          <div className="pointer-events-auto w-full max-w-md">
            <AnimatePresence mode="wait">
              {tab === "ride" && (
                <RideCard
                  key="ride"
                  pickupRef={pickupRef}
                  onSubmit={handleBookingSubmit}
                />
              )}
              {tab === "drive" && (
                <DriveCard key="drive" onSubmit={() => navigate("/drive")} />
              )}
              {tab === "business" && (
                <BusinessCard key="business" onSubmit={() => navigate("/business")} />
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
  onSubmit: (pickup?: LocationValue, dropoff?: LocationValue) => void;
};

const RideCard = ({ pickupRef, onSubmit }: RideCardProps) => {
  const { t } = useTranslation();
  const [pickup, setPickup] = useState<LocationValue>({ description: "" });
  const [dropoff, setDropoff] = useState<LocationValue>({ description: "" });

  const submit = () => onSubmit(pickup, dropoff);

  return (
    <motion.div
      {...cardMotion}
      className="rounded-3xl bg-card/95 p-5 shadow-2xl ring-1 ring-border/40 backdrop-blur-xl md:p-6"
    >
      <h2 className="mb-4 text-xl font-black tracking-tight md:text-2xl">
        {t("landing.getRideTitle", "Get a ride")}
      </h2>

      <div className="space-y-2">
        <LocationInput
          ref={pickupRef}
          value={pickup}
          onChange={setPickup}
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
  placeholder?: string;
  dotKind: "circle" | "square";
  trailing?: React.ReactNode;
};

const LocationInput = forwardRef<HTMLInputElement, LocationInputProps>(({
  value,
  onChange,
  placeholder,
  dotKind,
  trailing,
}, forwardedRef) => {
  const { t } = useTranslation();
  const [suggestions, setSuggestions] = useState<Prediction[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recents, setRecents] = useState<RecentLocation[]>(() => readRecents());
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
        writeRecents({ ...next, ts: Date.now() });
        setRecents(readRecents());
      }
    } catch {
      /* ignore — keep typed description */
    }
  };

  const handleSelectRecent = (r: RecentLocation) => {
    setOpen(false);
    onChange({ description: r.description, lat: r.lat, lng: r.lng });
    writeRecents({ ...r, ts: Date.now() });
    setRecents(readRecents());
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

  // Refresh recents when the input gains focus (in case another instance updated them)
  const handleFocus = () => {
    setRecents(readRecents());
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
