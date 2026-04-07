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
  CheckCircle2,
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

  const highlights = [
    t("landing.highlightOne"),
    t("landing.highlightTwo"),
    t("landing.highlightThree"),
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
    {
      q: t("landing.faqAirportQ"),
      a: t("landing.faqAirportA"),
    },
    {
      q: t("landing.faqLongDistanceQ"),
      a: t("landing.faqLongDistanceA"),
    },
    {
      q: t("landing.faqCourierQ"),
      a: t("landing.faqCourierA"),
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="sticky top-0 z-50 border-b border-border/60 bg-background/90 backdrop-blur-xl">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-3"
            aria-label="RideMoose home"
          >
            <img src={logoImg} alt="RideMoose" className="h-10 w-10 rounded-lg" />
            <div className="text-left">
              <p className="text-sm font-semibold tracking-wide">RideMoose</p>
              <p className="text-xs text-muted-foreground">Yellowknife & regional rides</p>
            </div>
          </button>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Button variant="outline" size="sm" onClick={() => navigate("/login")}>
              {t("nav.signIn")}
            </Button>
          </div>
        </div>
      </nav>

      <section className="relative overflow-hidden px-4 pb-16 pt-16 md:pb-24 md:pt-24">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,hsla(45,95%,55%,0.14),transparent_42%)]" />
        <div className="container relative mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            className="space-y-8"
          >
            <div className="space-y-4">
              <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                {t("landing.badge")}
              </div>
              <h1 className="max-w-3xl text-4xl font-black leading-tight md:text-6xl">
                {t("landing.heroTitle1")} <span className="text-gradient-gold">{t("landing.heroTitle2")}</span>
              </h1>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
                {t("landing.heroDesc")}
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button size="lg" className="px-8 text-base font-semibold" onClick={() => navigate("/login")}>
                {t("landing.requestRide")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button variant="outline" size="lg" className="px-8 text-base font-semibold" onClick={() => navigate("/login")}>
                {t("landing.requestLongDistance")}
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {highlights.map((item) => (
                <div key={item} className="rounded-2xl border border-border/50 bg-card/60 px-4 py-3 text-sm text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{item}</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.12 }}
            className="glass-surface rounded-[28px] p-6 shadow-[var(--shadow-card)]"
          >
            <div className="space-y-6">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary/80">
                  {t("landing.panelEyebrow")}
                </p>
                <h2 className="mt-2 text-2xl font-bold">{t("landing.panelTitle")}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {t("landing.panelDesc")}
                </p>
              </div>

              <div className="space-y-3 rounded-2xl border border-border/50 bg-secondary/35 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t("landing.phoneLabel")}</span>
                  <span className="font-semibold">(867) 988-8836</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t("landing.airportLabel")}</span>
                  <span className="font-semibold">{t("landing.airportValue")}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t("landing.longDistanceLabel")}</span>
                  <span className="font-semibold">{t("landing.longDistanceValue")}</span>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {services.map((service) => (
                  <div
                    key={service.title}
                    className="rounded-2xl border border-border/50 bg-card/70 p-4 sm:last:col-span-2"
                  >
                    <service.icon className="h-5 w-5 text-primary" />
                    <h3 className="mt-3 text-base font-semibold">{service.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{service.desc}</p>
                  </div>
                ))}
              </div>

              <Button className="w-full font-semibold" onClick={() => navigate("/login")}>
                {t("landing.bookOnline")}
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="px-4 py-16 md:py-20">
        <div className="container mx-auto max-w-6xl space-y-8">
          <div className="max-w-2xl space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary/80">
              {t("landing.sectionServices")}
            </p>
            <h2 className="text-3xl font-bold tracking-tight">{t("landing.servicesTitle")}</h2>
            <p className="text-muted-foreground">{t("landing.servicesDesc")}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {quickFacts.map((fact) => (
              <div key={fact.title} className="rounded-3xl border border-border/50 bg-card/60 p-6">
                <fact.icon className="h-8 w-8 text-primary" />
                <h3 className="mt-4 text-xl font-semibold">{fact.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{fact.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-border/50 bg-secondary/20 px-4 py-16 md:py-20">
        <div className="container mx-auto max-w-6xl space-y-8">
          <div className="max-w-2xl space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary/80">
              {t("landing.sectionCoverage")}
            </p>
            <h2 className="text-3xl font-bold tracking-tight">{t("landing.coverageTitle")}</h2>
            <p className="text-muted-foreground">{t("landing.coverageDesc")}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-semibold text-primary sm:col-span-2 lg:col-span-2">
              {t("landing.yellowknifePrimaryCard")}
            </div>
            {destinations.map((community) => (
              <div
                key={community}
                className="rounded-2xl border border-border/50 bg-background/60 px-4 py-3 text-sm font-medium"
              >
                {community}
              </div>
            ))}
            <div className="rounded-2xl border border-border/50 bg-background/60 px-4 py-3 text-sm font-medium sm:col-span-2 lg:col-span-2">
              {t("landing.outOfTownCard")}
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-16 md:py-20">
        <div className="container mx-auto max-w-6xl">
          <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
            <div className="space-y-3">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary/80">
                {t("landing.sectionFaq")}
              </p>
              <h2 className="text-3xl font-bold tracking-tight">{t("landing.faqTitle")}</h2>
              <p className="text-muted-foreground">{t("landing.faqDesc")}</p>
            </div>
            <div className="space-y-4">
              {faqs.map((faq) => (
                <div key={faq.q} className="rounded-2xl border border-border/50 bg-card/60 p-5">
                  <h3 className="text-base font-semibold">{faq.q}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 pb-16 md:pb-24">
        <div className="container mx-auto max-w-6xl">
          <div className="overflow-hidden rounded-[32px] border border-primary/20 bg-gradient-to-br from-primary/12 via-card to-card p-8 md:p-10">
            <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <div className="space-y-4">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary/90">
                  {t("landing.ctaEyebrow")}
                </p>
                <h2 className="text-3xl font-bold tracking-tight md:text-4xl">{t("landing.ctaTitle")}</h2>
                <p className="max-w-2xl text-muted-foreground">{t("landing.ctaDesc")}</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
                <Button size="lg" className="px-8 font-semibold" onClick={() => navigate("/login")}>
                  {t("landing.requestRide")}
                </Button>
                <Button size="lg" variant="outline" className="px-8 font-semibold" onClick={() => window.location.href = "tel:+18679888836"}>
                  <Phone className="mr-2 h-4 w-4" />
                  {t("landing.callNow")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/60 px-4 py-8">
        <div className="container mx-auto flex flex-col gap-3 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
          <p>{t("landing.footer")}</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span>{t("landing.footerCoverage")}</span>
            <a href="tel:+18679888836" className="font-medium text-foreground hover:text-primary transition-colors">
              (867) 988-8836
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
