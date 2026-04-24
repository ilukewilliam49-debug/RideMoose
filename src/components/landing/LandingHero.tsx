import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ChevronDown, Navigation, Crosshair, Briefcase, Car } from "lucide-react";
import { useTranslation } from "react-i18next";

const YellowknifeMap = lazy(() => import("./YellowknifeMap"));

export type LandingTab = "ride" | "drive" | "business";

const readTabFromHash = (): LandingTab => {
  if (typeof window === "undefined") return "ride";
  const h = window.location.hash.replace("#", "");
  if (h === "drive" || h === "business") return h;
  return "ride";
};

const LandingHero = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [tab, setTab] = useState<LandingTab>(readTabFromHash);
  const pickupRef = useRef<HTMLInputElement>(null);

  // Sync with hash changes from the nav
  useEffect(() => {
    const onHash = () => setTab(readTabFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // Autofocus pickup when on Ride tab (desktop only — avoid mobile keyboard popping)
  useEffect(() => {
    if (tab !== "ride") return;
    if (typeof window === "undefined") return;
    if (window.matchMedia("(min-width: 768px)").matches) {
      pickupRef.current?.focus();
    }
  }, [tab]);

  return (
    <section className="relative">
      {/* Map — full bleed behind everything */}
      <div className="relative h-[calc(100vh-9rem)] min-h-[520px] w-full overflow-hidden md:h-[calc(100vh-5rem)] md:min-h-[600px]">
        <Suspense fallback={<div className="h-full w-full animate-pulse bg-muted" />}>
          <YellowknifeMap className="h-full w-full" />
        </Suspense>

        {/* Subtle gradient overlay for legibility on mobile bottom sheet */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-background/70 to-transparent md:hidden" />

        {/* Floating card: bottom-sheet on mobile, anchored left on desktop */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[500] flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] md:inset-y-0 md:right-auto md:left-8 md:items-center md:justify-start md:px-0 md:pb-0 lg:left-12">
          <div className="pointer-events-auto w-full max-w-md">
            <AnimatePresence mode="wait">
              {tab === "ride" && (
                <RideCard
                  key="ride"
                  pickupRef={pickupRef}
                  onSubmit={() => navigate("/login")}
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

type RideCardProps = {
  pickupRef: React.RefObject<HTMLInputElement>;
  onSubmit: () => void;
};

const RideCard = ({ pickupRef, onSubmit }: RideCardProps) => {
  const { t } = useTranslation();
  return (
    <motion.div
      {...cardMotion}
      className="rounded-3xl bg-card/95 p-5 shadow-2xl ring-1 ring-border/40 backdrop-blur-xl md:p-6"
    >
      <h2 className="mb-4 text-xl font-black tracking-tight md:text-2xl">
        {t("landing.getRideTitle", "Get a ride")}
      </h2>

      {/* Pickup */}
      <div className="space-y-2">
        <div className="group relative flex items-center gap-3 rounded-2xl bg-muted/60 px-4 py-3.5 ring-1 ring-transparent transition focus-within:bg-muted focus-within:ring-primary/40">
          <span className="flex h-2.5 w-2.5 shrink-0 rounded-full bg-foreground" aria-hidden />
          <input
            ref={pickupRef}
            type="text"
            placeholder={t("rider.searchPickup", "Pickup location")}
            onClick={onSubmit}
            readOnly
            className="w-full bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <button
            type="button"
            onClick={onSubmit}
            aria-label={t("landing.currentLocation", "Current location")}
            className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground"
          >
            <Crosshair className="h-4 w-4" />
          </button>
        </div>

        {/* Dropoff */}
        <div className="group relative flex items-center gap-3 rounded-2xl bg-muted/60 px-4 py-3.5 ring-1 ring-transparent transition focus-within:bg-muted focus-within:ring-primary/40">
          <span className="flex h-2.5 w-2.5 shrink-0 rounded-sm bg-primary" aria-hidden />
          <input
            type="text"
            placeholder={t("rider.searchDropoff", "Dropoff location")}
            onClick={onSubmit}
            readOnly
            className="w-full bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <Navigation className="ml-auto h-4 w-4 text-muted-foreground/50" aria-hidden />
        </div>
      </div>

      {/* Controls */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onSubmit}
          className="flex items-center justify-between gap-2 rounded-xl bg-muted/60 px-3.5 py-2.5 text-left text-xs font-semibold transition hover:bg-muted"
        >
          <span className="truncate">{t("rider.pickupNow", "Pickup now")}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        <button
          type="button"
          onClick={onSubmit}
          className="flex items-center justify-between gap-2 rounded-xl bg-muted/60 px-3.5 py-2.5 text-left text-xs font-semibold transition hover:bg-muted"
        >
          <span className="truncate">{t("rider.forMe", "For me")}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>

      {/* CTA */}
      <Button
        size="lg"
        onClick={onSubmit}
        className="mt-4 h-12 w-full rounded-xl text-sm font-bold"
      >
        {t("landing.requestRide")}
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </motion.div>
  );
};

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
