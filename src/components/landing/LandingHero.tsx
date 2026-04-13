import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { MapPin, Navigation, ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import heroBg from "@/assets/hero-bg.jpg";

const LandingHero = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="grid min-h-[480px] items-center gap-8 py-12 md:grid-cols-2 md:py-20 lg:min-h-[540px]">
          {/* Left — copy + form */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-6 md:space-y-8"
          >
            <h1 className="text-[2.25rem] font-black leading-[1.08] tracking-tight md:text-6xl lg:text-[4rem]">
              {t("landing.heroTitle1")}{" "}
              <span className="text-primary">{t("landing.heroTitle2")}</span>
            </h1>

            {/* Booking form card */}
            <div className="space-y-3">
              <button
                onClick={() => navigate("/login")}
                className="group flex w-full items-center gap-3 rounded-xl bg-card px-4 py-3.5 text-left ring-1 ring-border/50 transition-colors hover:ring-primary/40"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                </div>
                <span className="text-sm text-muted-foreground">
                  {t("rider.searchPickup", "Pickup location")}
                </span>
                <Navigation className="ml-auto h-4 w-4 text-muted-foreground/40" />
              </button>

              <button
                onClick={() => navigate("/login")}
                className="group flex w-full items-center gap-3 rounded-xl bg-card px-4 py-3.5 text-left ring-1 ring-border/50 transition-colors hover:ring-primary/40"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                  <div className="h-2.5 w-2.5 rounded-sm bg-muted-foreground" />
                </div>
                <span className="text-sm text-muted-foreground">
                  {t("rider.searchDropoff", "Dropoff location")}
                </span>
              </button>

              <div className="flex gap-3 pt-1">
                <Button
                  size="lg"
                  className="h-12 flex-1 rounded-xl text-sm font-bold"
                  onClick={() => navigate("/login")}
                >
                  See prices
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>

            <button
              onClick={() => navigate("/login")}
              className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline transition-colors"
            >
              Log in to see your recent activity
            </button>
          </motion.div>

          {/* Right — hero image */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="relative hidden md:block"
          >
            <div className="relative overflow-hidden rounded-3xl">
              <img
                src={heroBg}
                alt="PickYou ride"
                width={640}
                height={480}
                className="h-[400px] w-full object-cover lg:h-[460px]"
              />
              {/* Schedule card overlay */}
              <div className="absolute bottom-4 right-4 rounded-2xl bg-card/90 backdrop-blur-sm px-5 py-3.5 ring-1 ring-border/30">
                <p className="text-xs text-muted-foreground mb-1">Ready to travel?</p>
                <button
                  onClick={() => navigate("/login")}
                  className="text-sm font-bold text-primary hover:underline"
                >
                  Schedule ahead →
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default LandingHero;
