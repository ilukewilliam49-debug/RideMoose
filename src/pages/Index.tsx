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
} from "lucide-react";
import logoImg from "@/assets/logo.png";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

const Index = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const products = [
    {
      icon: Car,
      title: t("landing.serviceTaxiTitle"),
      desc: t("landing.serviceTaxiDesc"),
      action: () => navigate("/login"),
    },
    {
      icon: Plane,
      title: t("landing.serviceAirportTitle"),
      desc: t("landing.serviceAirportDesc"),
      action: () => navigate("/login"),
    },
    {
      icon: Package,
      title: t("landing.serviceCourierTitle"),
      desc: t("landing.serviceCourierDesc"),
      action: () => navigate("/login"),
    },
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

  const destinations = [
    "Behchokò",
    "Rae-Edzo",
    "Gamètì",
    "Fort Providence",
    "Kakisa",
    "Hay River",
  ];

  const faqs = [
    { q: t("landing.faqAirportQ"), a: t("landing.faqAirportA") },
    { q: t("landing.faqLongDistanceQ"), a: t("landing.faqLongDistanceA") },
    { q: t("landing.faqCourierQ"), a: t("landing.faqCourierA") },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 border-b border-border/40 bg-background/95 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
          <button onClick={() => navigate("/")} className="flex items-center gap-2.5" aria-label="RideMoose home">
            <img src={logoImg} alt="RideMoose" className="h-9 w-9 rounded-lg" />
            <span className="text-lg font-bold tracking-tight">RideMoose</span>
          </button>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <Button variant="ghost" size="sm" className="font-semibold" onClick={() => navigate("/login")}>
              {t("nav.signIn")}
            </Button>
            <Button size="sm" className="rounded-full px-5 font-semibold" onClick={() => navigate("/login")}>
              {t("landing.requestRide")}
            </Button>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden px-5 pt-16 pb-20 md:pt-28 md:pb-32">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,hsla(45,95%,55%,0.12),transparent)]" />
        <div className="relative mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-2xl space-y-6"
          >
            <h1 className="text-5xl font-black leading-[1.08] tracking-tight md:text-7xl">
              {t("landing.heroTitle1")}{" "}
              <span className="text-gradient-gold">{t("landing.heroTitle2")}</span>
            </h1>
            <p className="max-w-lg text-lg leading-relaxed text-muted-foreground">
              {t("landing.heroDesc")}
            </p>

            {/* "Where to?" CTA — Uber signature */}
            <button
              onClick={() => navigate("/login")}
              className="group flex w-full max-w-md items-center gap-3 rounded-2xl bg-card border border-border/60 px-5 py-4 text-left transition-all hover:border-primary/40 hover:shadow-[0_0_24px_-6px_hsl(45_95%_55%/0.15)] active:scale-[0.98]"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <MapPin className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-semibold">{t("landing.whereTo") || "Where to?"}</p>
                <p className="text-sm text-muted-foreground truncate">{t("landing.heroDesc2") || "Enter your destination"}</p>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground/50 group-hover:text-primary transition-colors" />
            </button>
          </motion.div>
        </div>
      </section>

      {/* ── Product tiles ── */}
      <section className="px-5 pb-20">
        <div className="mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/80 mb-5">
              {t("landing.sectionServices")}
            </p>
          </motion.div>

          <div className="grid gap-4 md:grid-cols-3">
            {products.map((product, i) => (
              <motion.button
                key={product.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.35 }}
                onClick={product.action}
                className="group relative flex flex-col justify-between rounded-[20px] border border-border/40 bg-card p-6 text-left transition-all duration-200 hover:border-primary/30 hover:shadow-[0_4px_32px_-8px_hsl(45_95%_55%/0.1)] active:scale-[0.98] min-h-[180px]"
              >
                <div className="flex items-start justify-between w-full">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                    <product.icon className="h-6 w-6 text-primary" />
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground/30 group-hover:text-primary/60 transition-colors mt-1" />
                </div>
                <div className="mt-auto pt-5">
                  <h3 className="text-lg font-bold leading-tight">{product.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed line-clamp-2">{product.desc}</p>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why RideMoose ── */}
      <section className="border-y border-border/40 bg-secondary/15 px-5 py-20">
        <div className="mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="max-w-xl space-y-3 mb-10"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/80">
              {t("landing.servicesTitle") || "Why RideMoose"}
            </p>
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              {t("landing.servicesDesc") || "Built for the North"}
            </h2>
          </motion.div>

          <div className="grid gap-4 md:grid-cols-3">
            {quickFacts.map((fact, i) => (
              <motion.div
                key={fact.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.35 }}
                className="rounded-[20px] border border-border/40 bg-card/80 p-6"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 mb-5">
                  <fact.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-lg font-bold">{fact.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{fact.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Coverage ── */}
      <section className="px-5 py-20">
        <div className="mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="max-w-xl space-y-3 mb-10"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/80">
              {t("landing.sectionCoverage")}
            </p>
            <h2 className="text-3xl font-bold tracking-tight">{t("landing.coverageTitle")}</h2>
            <p className="text-muted-foreground">{t("landing.coverageDesc")}</p>
          </motion.div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2 rounded-2xl border border-primary/25 bg-primary/8 px-5 py-4 text-sm font-semibold text-primary flex items-center gap-3">
              <MapPin className="h-5 w-5 shrink-0" />
              {t("landing.yellowknifePrimaryCard")}
            </div>
            {destinations.map((community) => (
              <div key={community} className="rounded-2xl border border-border/40 bg-card/60 px-5 py-4 text-sm font-medium">
                {community}
              </div>
            ))}
            <div className="sm:col-span-2 rounded-2xl border border-border/40 bg-card/60 px-5 py-4 text-sm font-medium">
              {t("landing.outOfTownCard")}
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="border-t border-border/40 bg-secondary/10 px-5 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
              className="space-y-3"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/80">
                {t("landing.sectionFaq")}
              </p>
              <h2 className="text-3xl font-bold tracking-tight">{t("landing.faqTitle")}</h2>
              <p className="text-muted-foreground">{t("landing.faqDesc")}</p>
            </motion.div>
            <div className="space-y-3">
              {faqs.map((faq, i) => (
                <motion.div
                  key={faq.q}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.06, duration: 0.3 }}
                  className="rounded-[16px] border border-border/40 bg-card/70 p-5"
                >
                  <h3 className="text-base font-semibold">{faq.q}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{faq.a}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="px-5 py-20">
        <div className="mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="overflow-hidden rounded-[28px] border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card p-8 md:p-12"
          >
            <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
              <div className="space-y-4">
                <h2 className="text-3xl font-bold tracking-tight md:text-4xl">{t("landing.ctaTitle")}</h2>
                <p className="max-w-lg text-muted-foreground">{t("landing.ctaDesc")}</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
                <Button size="lg" className="rounded-full px-8 font-semibold" onClick={() => navigate("/login")}>
                  {t("landing.requestRide")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button size="lg" variant="outline" className="rounded-full px-8 font-semibold" onClick={() => window.location.href = "tel:+18679888836"}>
                  <Phone className="mr-2 h-4 w-4" />
                  {t("landing.callNow")}
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border/40 px-5 py-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
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
