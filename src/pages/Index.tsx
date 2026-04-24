import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import InstallAppPrompt from "@/components/InstallAppPrompt";
import { Button } from "@/components/ui/button";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, Phone } from "lucide-react";
import { useTranslation } from "react-i18next";

import LandingNav from "@/components/landing/LandingNav";
import LandingHero, { type LandingTab } from "@/components/landing/LandingHero";
import LandingDriver from "@/components/landing/LandingDriver";
import LandingFooter from "@/components/landing/LandingFooter";
import { useAuth } from "@/hooks/useAuth";
import { useActiveRole } from "@/contexts/ActiveRoleContext";
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
  const showPublicLanding = new URLSearchParams(location.search).get("view") === "landing";
  const [tab, setTab] = useState<LandingTab>(readTabFromHash);

  useEffect(() => {
    const onHash = () => setTab(readTabFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <InstallAppPrompt />
      <LandingNav />
      <LandingHero />

      {/* Driver recruitment section + bottom CTA only appear on the Drive tab.
          Ride tab stays focused on rider booking; Business tab on business CTA. */}
      {tab === "drive" && (
        <>
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
        </>
      )}

      <LandingFooter />
    </div>
  );
};

export default Index;
