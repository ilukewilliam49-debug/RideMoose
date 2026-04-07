import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import {
  Car,
  Plane,
  Package,
  Shield,
  Clock3,
  MapPin,
  ArrowRight,
  Phone,
  ChevronRight,
  Wallet,
  CalendarClock,
  Layers,
} from "lucide-react";
import logoImg from "@/assets/logo.png";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

const Index = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const services = [
    {
      icon: Car,
      title: t("landing.serviceTaxiTitle"),
      desc: t("landing.serviceTaxiDesc"),
    },
    {
      icon: Plane,
      title: t("landing.serviceAirportTitle"),
      desc: t("landing.serviceAirportDesc"),
    },
    {
      icon: Package,
      title: t("landing.serviceCourierTitle"),
      desc: t("landing.serviceCourierDesc"),
    },
  ];

  const destinations = [
    "Behchokò",
    "Rae-Edzo",
    "Gamètì",
    "Fort Providence",
    "Kakisa",
    "Hay River",
  ];

  const quickFacts = [
    {
      icon: Shield,
      title: t("landing.factSafeTitle"),
      desc: t("landing.factSafeDesc"),
    },
    {
      icon: Clock3,
      title: t("landing.factAvailableTitle"),
      desc: t("landing.factAvailableDesc"),
    },
    {
      icon: MapPin,
      title: t("landing.factRegionalTitle"),
      desc: t("landing.factRegionalDesc"),
    },
  ];

  const faqs = [
    { q: t("landing.faqAirportQ"), a: t("landing.faqAirportA") },
    { q: t("landing.faqLongDistanceQ"), a: t("landing.faqLongDistanceA") },
    { q: t("landing.faqCourierQ"), a: t("landing.faqCourierA") },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 border-b border-border/40 bg-background/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2.5"
            aria-label="RideMoose home"
          >
            <img src={logoImg} alt="RideMoose" className="h-9 w-9 rounded-xl" />
            <span className="text-base font-bold tracking-tight">RideMoose</span>
          </button>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Button
              size="sm"
              className="rounded-full px-5 text-xs font-bold uppercase tracking-wider"
              onClick={() => navigate("/login")}
            >
              {t("nav.signIn")}
            </Button>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        {/* Gradient backdrop */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,hsl(45_95%_55%/0.12),transparent)]" />

        <div className="relative mx-auto max-w-7xl px-5 pb-20 pt-16 md:pb-28 md:pt-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-3xl space-y-7"
          >
            <h1 className="text-[2.75rem] font-black leading-[1.08] tracking-tight md:text-7xl">
              {t("landing.heroTitle1")}{" "}
              <span className="text-gradient-gold">{t("landing.heroTitle2")}</span>
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-muted-foreground md:text-xl">
              {t("landing.heroDesc")}
            </p>

            <div className="flex flex-wrap gap-3 pt-1">
              <Button
                size="lg"
                className="h-14 rounded-2xl px-8 text-base font-bold shadow-[var(--shadow-gold)] active:scale-[0.98] transition-transform"
                onClick={() => navigate("/login")}
              >
                {t("landing.requestRide")}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                variant="secondary"
                size="lg"
                className="h-14 rounded-2xl px-8 text-base font-bold active:scale-[0.98] transition-transform"
                onClick={() => navigate("/login")}
              >
                {t("landing.requestLongDistance")}
              </Button>
            </div>
          </motion.div>

          {/* Service Cards — Uber-style horizontal row */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.45 }}
            className="mt-14 grid gap-4 sm:grid-cols-3"
          >
            {services.map((service, i) => (
              <motion.button
                key={service.title}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 + i * 0.08, duration: 0.35 }}
                onClick={() => navigate("/login")}
                className="group relative flex items-start gap-4 rounded-[20px] border border-border/40 bg-card/70 p-5 text-left transition-all duration-200 hover:border-primary/30 hover:bg-card active:scale-[0.98]"
                style={{ boxShadow: "inset 0 1px 0 0 hsl(0 0% 100%/0.04), 0 2px 12px -4px hsl(0 0% 0%/0.3)" }}
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
                  <service.icon className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold">{service.title}</h3>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary/70 transition-colors" />
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground line-clamp-2">{service.desc}</p>
                </div>
              </motion.button>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Quick facts — full-width strip ── */}
      <section className="border-y border-border/40 bg-secondary/20">
        <div className="mx-auto grid max-w-7xl gap-0 divide-y divide-border/30 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {quickFacts.map((fact) => (
            <div key={fact.title} className="flex items-start gap-4 px-6 py-8 md:py-10">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
                <fact.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-base font-bold">{fact.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{fact.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Coverage / destinations ── */}
      <section className="px-5 py-16 md:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-xl space-y-3">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary/80">
              {t("landing.sectionCoverage")}
            </p>
            <h2 className="text-3xl font-black tracking-tight md:text-4xl">{t("landing.coverageTitle")}</h2>
            <p className="text-muted-foreground leading-relaxed">{t("landing.coverageDesc")}</p>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-primary/25 bg-primary/8 px-5 py-4 text-sm font-bold text-primary sm:col-span-2 lg:col-span-2">
              {t("landing.yellowknifePrimaryCard")}
            </div>
            {destinations.map((community) => (
              <div
                key={community}
                className="rounded-2xl border border-border/40 bg-card/50 px-5 py-4 text-sm font-semibold"
              >
                {community}
              </div>
            ))}
            <div className="rounded-2xl border border-border/40 bg-card/50 px-5 py-4 text-sm font-semibold sm:col-span-2 lg:col-span-2">
              {t("landing.outOfTownCard")}
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="border-t border-border/40 bg-secondary/10 px-5 py-16 md:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary/80">
                {t("landing.sectionFaq")}
              </p>
              <h2 className="text-3xl font-black tracking-tight md:text-4xl">{t("landing.faqTitle")}</h2>
              <p className="text-muted-foreground leading-relaxed">{t("landing.faqDesc")}</p>
            </div>
            <div className="space-y-4">
              {faqs.map((faq) => (
                <div key={faq.q} className="rounded-2xl border border-border/40 bg-card/60 p-6">
                  <h3 className="text-base font-bold">{faq.q}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA banner ── */}
      <section className="px-5 py-16 md:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="overflow-hidden rounded-[28px] border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card p-8 md:p-12">
            <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <div className="space-y-4">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary/90">
                  {t("landing.ctaEyebrow")}
                </p>
                <h2 className="text-3xl font-black tracking-tight md:text-4xl">{t("landing.ctaTitle")}</h2>
                <p className="max-w-xl text-muted-foreground leading-relaxed">{t("landing.ctaDesc")}</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
                <Button
                  size="lg"
                  className="h-14 rounded-2xl px-8 font-bold shadow-[var(--shadow-gold)] active:scale-[0.98] transition-transform"
                  onClick={() => navigate("/login")}
                >
                  {t("landing.requestRide")}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-14 rounded-2xl px-8 font-bold active:scale-[0.98] transition-transform"
                  onClick={() => (window.location.href = "tel:+18679888836")}
                >
                  <Phone className="mr-2 h-4 w-4" />
                  {t("landing.callNow")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border/40 px-5 py-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
          <p>{t("landing.footer")}</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span>{t("landing.footerCoverage")}</span>
            <a
              href="tel:+18679888836"
              className="font-semibold text-foreground hover:text-primary transition-colors"
            >
              (867) 988-8836
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
