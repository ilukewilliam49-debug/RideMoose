import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import {
  Car,
  Plane,
  Package,
  ArrowRight,
  Phone,
  ChevronRight,
  Wallet,
  CalendarClock,
  Layers,
} from "lucide-react";
import logoImg from "@/assets/logo.png";
import heroBg from "@/assets/hero-bg.jpg";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

const Index = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const services = [
    { icon: Car, title: t("landing.serviceTaxiTitle"), desc: t("landing.serviceTaxiDesc") },
    { icon: Plane, title: t("landing.serviceAirportTitle"), desc: t("landing.serviceAirportDesc") },
    { icon: Package, title: t("landing.serviceCourierTitle"), desc: t("landing.serviceCourierDesc") },
  ];

  const driverPerks = [
    { icon: CalendarClock, title: t("landing.drivePerkFlexible"), desc: t("landing.drivePerkFlexibleDesc") },
    { icon: Wallet, title: t("landing.drivePerkEarnings"), desc: t("landing.drivePerkEarningsDesc") },
    { icon: Layers, title: t("landing.drivePerkServices"), desc: t("landing.drivePerkServicesDesc") },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 bg-background/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
          <button
            onClick={() => navigate("/")}
            className="flex items-center"
            aria-label="RideMoose home"
          >
            <span className="text-lg font-black tracking-tight">Ride<span className="text-primary">Moose</span></span>
          </button>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Button
              size="sm"
              className="rounded-full px-5 text-xs font-bold"
              onClick={() => navigate("/login")}
            >
              {t("nav.signIn")}
            </Button>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden px-5 pb-6 pt-10 md:pt-20 md:pb-10">
        {/* Background image */}
        <img
          src={heroBg}
          alt=""
          width={1920}
          height={1080}
          className="absolute inset-0 h-full w-full object-cover object-center"
          aria-hidden="true"
        />
        {/* Dark overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/70 to-background" />
        <div className="relative mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="space-y-5"
          >
            <h1 className="text-[2.5rem] font-black leading-[1.05] tracking-tight md:text-7xl md:max-w-4xl">
              {t("landing.heroTitle1")}{" "}
              <span className="text-gradient-gold">{t("landing.heroTitle2")}</span>
            </h1>
            <p className="max-w-md text-base leading-relaxed text-muted-foreground md:text-lg md:max-w-xl">
              {t("landing.heroDesc")}
            </p>
            <div className="flex gap-3 pt-2">
              <Button
                size="lg"
                className="h-[52px] rounded-xl px-7 text-[15px] font-bold shadow-[var(--shadow-gold)] active:scale-[0.97] transition-transform"
                onClick={() => navigate("/login")}
              >
                {t("landing.requestRide")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Services ── */}
      <section className="px-5 pb-10 pt-6 md:py-16">
        <div className="mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.12, duration: 0.4 }}
            className="space-y-3"
          >
            {services.map((service, i) => (
              <motion.button
                key={service.title}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18 + i * 0.06, duration: 0.3 }}
                onClick={() => navigate("/login")}
                className="group flex w-full items-center gap-4 rounded-2xl bg-card/50 px-5 py-4 text-left transition-colors duration-150 hover:bg-card active:scale-[0.99]"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <service.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-[15px] font-bold leading-tight">{service.title}</h3>
                  <p className="text-[13px] leading-snug text-muted-foreground mt-0.5 line-clamp-1">{service.desc}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/30 group-hover:text-primary/60 transition-colors" />
              </motion.button>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Divider ── */}
      <div className="mx-5 h-px bg-border/30 md:mx-auto md:max-w-7xl" />

      {/* ── Drive with RideMoose ── */}
      <section className="px-5 py-12 md:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="space-y-6">
            <div className="space-y-3">
              <h2 className="text-2xl font-black tracking-tight md:text-4xl">
                {t("landing.driveTitle")}
              </h2>
              <p className="max-w-lg text-[15px] leading-relaxed text-muted-foreground">
                {t("landing.driveDesc")}
              </p>
            </div>

            <div className="space-y-2.5">
              {driverPerks.map((perk) => (
                <div
                  key={perk.title}
                  className="flex items-center gap-4 rounded-2xl bg-card/50 px-5 py-4"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <perk.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-[15px] font-bold leading-tight">{perk.title}</h3>
                    <p className="text-[13px] leading-snug text-muted-foreground mt-0.5">{perk.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <Button
              size="lg"
              variant="outline"
              className="h-[52px] w-full rounded-xl text-[15px] font-bold active:scale-[0.97] transition-transform sm:w-auto sm:px-8"
              onClick={() => navigate("/login")}
            >
              {t("landing.driveApply")}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* ── Divider ── */}
      <div className="mx-5 h-px bg-border/30 md:mx-auto md:max-w-7xl" />

      {/* ── Bottom CTA ── */}
      <section className="px-5 py-12 md:py-20">
        <div className="mx-auto max-w-7xl space-y-5">
          <h2 className="text-2xl font-black tracking-tight md:text-4xl md:max-w-2xl">
            {t("landing.ctaTitle")}
          </h2>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              size="lg"
              className="h-[52px] rounded-xl px-7 text-[15px] font-bold shadow-[var(--shadow-gold)] active:scale-[0.97] transition-transform"
              onClick={() => navigate("/login")}
            >
              {t("landing.requestRide")}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button
              size="lg"
              variant="secondary"
              className="h-[52px] rounded-xl px-7 text-[15px] font-bold active:scale-[0.97] transition-transform"
              onClick={() => (window.location.href = "tel:+18679888836")}
            >
              <Phone className="mr-2 h-4 w-4" />
              {t("landing.callNow")}
            </Button>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border/30 px-5 py-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 text-xs text-muted-foreground/70 md:flex-row md:items-center md:justify-between">
          <p>{t("landing.footer")}</p>
          <a
            href="tel:+18679888836"
            className="font-medium text-muted-foreground hover:text-primary transition-colors"
          >
            (867) 988-8836
          </a>
        </div>
      </footer>
    </div>
  );
};

export default Index;
