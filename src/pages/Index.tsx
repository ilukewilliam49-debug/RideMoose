import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Phone } from "lucide-react";
import { useTranslation } from "react-i18next";

import LandingNav from "@/components/landing/LandingNav";
import LandingHero from "@/components/landing/LandingHero";
import LandingServices from "@/components/landing/LandingServices";
import LandingDriver from "@/components/landing/LandingDriver";
import LandingFooter from "@/components/landing/LandingFooter";

const Index = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <LandingNav />
      <LandingHero />
      <LandingServices />
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

      <LandingFooter />
    </div>
  );
};

export default Index;
