import { useEffect, useMemo, useState } from "react";
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
  Phone,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import LandingNav from "@/components/landing/LandingNav";
import LandingHero, { type LandingTab } from "@/components/landing/LandingHero";
import LandingDriver from "@/components/landing/LandingDriver";
import LandingFooter from "@/components/landing/LandingFooter";
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
                onSelect={() => {
                  setMoreOpen(false);
                  navigate("/login?intent=schedule");
                }}
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

export default Index;
