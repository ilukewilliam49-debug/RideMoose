import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import InstallAppPrompt from "@/components/InstallAppPrompt";
import { Button } from "@/components/ui/button";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, ChevronDown, ChevronUp, Phone } from "lucide-react";
import { useTranslation } from "react-i18next";

import LandingNav from "@/components/landing/LandingNav";
import LandingHero, { type LandingTab } from "@/components/landing/LandingHero";
import LandingDriver from "@/components/landing/LandingDriver";
import LandingFooter from "@/components/landing/LandingFooter";
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
  // Mobile-only: keep marketing content collapsed by default so the homepage
  // feels like a ride-booking app (map + sheet first). Tapping "Explore PickYou"
  // reveals the footer. Driver content is NEVER shown on the Ride tab.
  const [mobileExpanded, setMobileExpanded] = useState(false);

  useEffect(() => {
    const onHash = () => setTab(readTabFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // Reset the mobile expand state whenever the user switches tabs so the
  // Ride tab always returns to its collapsed map-first view.
  useEffect(() => {
    setMobileExpanded(false);
  }, [tab]);

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
  // Footer is hidden on the mobile Ride tab until the user explicitly expands.
  // Drive and Business tabs always show the footer.
  const showFooter = !isMobile || tab !== "ride" || mobileExpanded;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <InstallAppPrompt />
      <LandingNav />
      <LandingHero />

      {/* Mobile-only "Explore PickYou" toggle. Sits flush under the hero on the
          Ride tab and reveals the footer. Driver content is NOT included. */}
      {isMobile && tab === "ride" && (
        <div className="flex justify-center border-t border-border/30 bg-background px-5 py-4 md:hidden">
          <button
            type="button"
            onClick={() => setMobileExpanded((v) => !v)}
            aria-expanded={mobileExpanded}
            aria-controls="mobile-explore-panel"
            className="inline-flex items-center gap-2 rounded-full bg-muted/70 px-5 py-2.5 text-xs font-bold text-foreground ring-1 ring-border/40 transition active:scale-[0.98]"
          >
            {mobileExpanded ? (
              <>
                {t("landing.exploreLess", "Show less")}
                <ChevronUp className="h-4 w-4" />
              </>
            ) : (
              <>
                {t("landing.exploreMore", "Explore PickYou")}
                <ChevronDown className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
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

      {/* Footer is gated on mobile Ride until the user expands. Animated only
          when toggled from the mobile expand button. */}
      <AnimatePresence initial={false}>
        {showFooter && (
          <motion.div
            id="mobile-explore-panel"
            key="footer-panel"
            initial={isMobile && tab === "ride" ? { height: 0, opacity: 0 } : false}
            animate={{ height: "auto", opacity: 1 }}
            exit={isMobile && tab === "ride" ? { height: 0, opacity: 0 } : undefined}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <LandingFooter />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Index;
