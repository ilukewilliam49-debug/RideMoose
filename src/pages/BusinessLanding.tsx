import { useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Building2,
  Receipt,
  CreditCard,
  ShieldCheck,
  Users,
  ArrowRight,
  CheckCircle2,
  Phone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import LandingNav from "@/components/landing/LandingNav";
import LandingFooter from "@/components/landing/LandingFooter";

const BusinessLanding = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    window.scrollTo(0, 0);
    const prevTitle = document.title;
    document.title = "PickYou for Business — Corporate Rides in Yellowknife";
    const meta = document.querySelector('meta[name="description"]');
    const prevDesc = meta?.getAttribute("content") ?? "";
    meta?.setAttribute(
      "content",
      "Streamline your team's transportation with PickYou for Business. Monthly invoicing, no driver payments, dedicated support across Yellowknife, NWT."
    );
    return () => {
      document.title = prevTitle;
      if (meta && prevDesc) meta.setAttribute("content", prevDesc);
    };
  }, []);

  const features = [
    {
      icon: Receipt,
      title: t("business.feature1Title", "Monthly invoicing"),
      desc: t(
        "business.feature1Desc",
        "Consolidated billing — one invoice for all employee rides, paid on net-30 terms."
      ),
    },
    {
      icon: CreditCard,
      title: t("business.feature2Title", "No driver payments"),
      desc: t(
        "business.feature2Desc",
        "Employees ride with zero out-of-pocket. All charges go straight to your company account."
      ),
    },
    {
      icon: Users,
      title: t("business.feature3Title", "Team management"),
      desc: t(
        "business.feature3Desc",
        "Add employees, assign cost centers, and track ride history per department."
      ),
    },
    {
      icon: ShieldCheck,
      title: t("business.feature4Title", "Vetted drivers"),
      desc: t(
        "business.feature4Desc",
        "All drivers are background-checked, insured, and locally verified in Yellowknife."
      ),
    },
  ];

  const benefits = [
    t("business.benefit1", "Dedicated account manager"),
    t("business.benefit2", "Priority dispatch for staff"),
    t("business.benefit3", "Detailed monthly ride reports"),
    t("business.benefit4", "Custom credit limits & PO numbers"),
    t("business.benefit5", "Tax-ready receipts (GST included)"),
    t("business.benefit6", "Cancel anytime — no contracts"),
  ];

  const handleApply = () => navigate("/rider/corporate-apply");

  return (
    <>
      <div className="min-h-screen bg-background text-foreground">
        <LandingNav />

        {/* Hero */}
        <section className="px-5 lg:px-8 pt-12 pb-16 md:pt-20 md:pb-24">
          <div className="mx-auto max-w-7xl">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="max-w-3xl space-y-6"
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-border/40 bg-card/50 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                <Building2 className="h-3.5 w-3.5" />
                {t("business.eyebrow", "PickYou for Business")}
              </div>
              <h1 className="text-4xl font-black tracking-tight md:text-6xl">
                {t("business.heroTitle", "Smarter rides for your whole team.")}
              </h1>
              <p className="text-base text-muted-foreground md:text-lg max-w-2xl leading-relaxed">
                {t(
                  "business.heroDesc",
                  "Give employees a faster way to move around Yellowknife — without expense reports, cash, or company cards. We invoice you monthly."
                )}
              </p>
              <div className="flex flex-col gap-3 sm:flex-row pt-2">
                <Button
                  size="lg"
                  className="h-12 rounded-xl px-7 text-sm font-bold"
                  onClick={handleApply}
                >
                  {t("business.applyCta", "Apply for a business account")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button
                  size="lg"
                  variant="secondary"
                  className="h-12 rounded-xl px-7 text-sm font-bold"
                  onClick={() => (window.location.href = "tel:+18679888836")}
                >
                  <Phone className="mr-2 h-4 w-4" />
                  {t("business.callSales", "Talk to sales")}
                </Button>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Features */}
        <section className="border-t border-border/30 px-5 lg:px-8 py-16 md:py-20">
          <div className="mx-auto max-w-7xl">
            <h2 className="text-2xl font-black tracking-tight md:text-4xl mb-10 max-w-2xl">
              {t("business.featuresTitle", "Built for the way your business moves.")}
            </h2>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {features.map((f, i) => (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.35, delay: i * 0.05 }}
                  className="rounded-2xl border border-border/40 bg-card/40 p-5 space-y-3"
                >
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-bold">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Benefits list */}
        <section className="border-t border-border/30 px-5 lg:px-8 py-16 md:py-20">
          <div className="mx-auto max-w-7xl grid gap-10 md:grid-cols-2 md:items-center">
            <div className="space-y-5">
              <h2 className="text-2xl font-black tracking-tight md:text-4xl">
                {t("business.benefitsTitle", "Everything your team needs in one account.")}
              </h2>
              <p className="text-base text-muted-foreground leading-relaxed">
                {t(
                  "business.benefitsDesc",
                  "From small offices to large operators, PickYou for Business adapts to your workflow with flexible billing and full visibility."
                )}
              </p>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {benefits.map((b) => (
                <li key={b} className="flex items-start gap-2.5 text-sm">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-primary mt-0.5" />
                  <span className="text-foreground/85 leading-relaxed">{b}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* CTA */}
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
                {t("business.ctaTitle", "Ready to upgrade how your team rides?")}
              </h2>
              <p className="text-base text-muted-foreground max-w-xl">
                {t(
                  "business.ctaDesc",
                  "Apply in under 5 minutes. We'll review and get you set up — usually within one business day."
                )}
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  size="lg"
                  className="h-12 rounded-xl px-7 text-sm font-bold"
                  onClick={handleApply}
                >
                  {t("business.applyCta", "Apply for a business account")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          </div>
        </section>

        <LandingFooter />
      </div>
    </>
  );
};

export default BusinessLanding;
