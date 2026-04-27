import { useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowRight, DollarSign, TrendingUp, Wallet, CalendarClock, Layers, MapPin, ShieldCheck, Lock, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import LandingNav from "@/components/landing/LandingNav";
import LandingFooter from "@/components/landing/LandingFooter";
import DriveHero from "@/components/drive/DriveHero";
import EarningsCalculator from "@/components/drive/EarningsCalculator";
import DriveHowItWorks from "@/components/drive/DriveHowItWorks";
import DriveRequirements from "@/components/drive/DriveRequirements";
import DriveFAQ from "@/components/drive/DriveFAQ";

const stats = [
  { icon: DollarSign, value: "95.1%", label: "You keep" },
  { icon: TrendingUp, value: "$1,200+", label: "Avg weekly" },
  { icon: Wallet, value: "Weekly", label: "Payouts" },
];

const perks = [
  { icon: DollarSign, title: "Industry-low 4.9% commission", desc: "Keep more of every fare than any major rideshare app." },
  { icon: CalendarClock, title: "Total schedule flexibility", desc: "No quotas, no minimum hours. Drive whenever you want." },
  { icon: Layers, title: "Multiple service types", desc: "Earn from taxi, courier, large-item delivery, and more." },
  { icon: MapPin, title: "Local Yellowknife support", desc: "Real human help from a team that knows the North." },
];

const trustItems = [
  { icon: ShieldCheck, label: "Background-checked drivers" },
  { icon: MapPin, label: "Local Yellowknife operations" },
  { icon: Lock, label: "Encrypted document handling" },
  { icon: Users, label: "Real human support team" },
];

const DriveLanding = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const prevTitle = document.title;
    document.title = "Drive with PickYou — Earn on Your Schedule in Yellowknife";

    const setMeta = (name: string, content: string) => {
      let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute("name", name);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
      return el;
    };

    const desc = setMeta(
      "description",
      "Become a PickYou driver in Yellowknife. Keep 95.1% of every fare, set your own hours, and get approved in 24 hours. Apply online today.",
    );

    // Canonical
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    const prevHref = canonical?.href;
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = "https://www.pickyou.ca/drive";

    return () => {
      document.title = prevTitle;
      if (prevHref && canonical) canonical.href = prevHref;
      desc.setAttribute(
        "content",
        "PickYou is a digital transportation platform that prioritizes user control, fair pricing, and seamless local mobility across Yellowknife and beyond.",
      );
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <LandingNav />
      <main>
        <DriveHero />

        {/* Earnings strip */}
        <section className="border-b border-border/30">
          <div className="mx-auto max-w-7xl px-5 lg:px-8 py-10 md:py-14">
            <div className="grid grid-cols-3 gap-3 md:gap-5 max-w-3xl mx-auto">
              {stats.map((stat, idx) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.35, delay: idx * 0.08 }}
                  className="flex flex-col items-center gap-1.5 rounded-2xl bg-card/60 ring-1 ring-border/30 px-4 py-5 md:py-7 text-center"
                >
                  <stat.icon className="h-5 w-5 text-primary mb-1" />
                  <span className="text-2xl md:text-3xl font-black tracking-tight">{stat.value}</span>
                  <span className="text-[10px] md:text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {stat.label}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <EarningsCalculator />
        <DriveHowItWorks />
        <DriveRequirements />

        {/* Why PickYou */}
        <section className="border-b border-border/30">
          <div className="mx-auto max-w-7xl px-5 lg:px-8 py-16 md:py-24">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45 }}
              className="text-center max-w-2xl mx-auto mb-12"
            >
              <p className="text-[11px] font-semibold uppercase tracking-widest text-primary mb-2">
                Why PickYou
              </p>
              <h2 className="text-3xl md:text-4xl font-black tracking-tight">Built for drivers, not against them</h2>
            </motion.div>

            <div className="grid gap-4 sm:grid-cols-2 max-w-4xl mx-auto">
              {perks.map((perk, idx) => (
                <motion.div
                  key={perk.title}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: idx * 0.08 }}
                  className="flex items-start gap-4 rounded-2xl bg-card/60 ring-1 ring-border/30 p-5 hover:ring-primary/30 transition-all"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <perk.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-[15px] font-bold leading-tight mb-1">{perk.title}</h3>
                    <p className="text-[13px] leading-relaxed text-muted-foreground">{perk.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <DriveFAQ />

        {/* Trust strip */}
        <section className="border-b border-border/30 bg-card/20">
          <div className="mx-auto max-w-7xl px-5 lg:px-8 py-12">
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4 max-w-4xl mx-auto">
              {trustItems.map((item) => (
                <div
                  key={item.label}
                  className="flex flex-col items-center gap-2 text-center"
                >
                  <item.icon className="h-5 w-5 text-primary" />
                  <span className="text-[12px] font-semibold text-foreground/80">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="border-b border-border/30">
          <div className="mx-auto max-w-7xl px-5 lg:px-8 py-20 md:py-28">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45 }}
              className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent ring-1 ring-primary/20 p-10 md:p-16 text-center"
            >
              <h2 className="text-3xl md:text-5xl font-black tracking-tight max-w-2xl mx-auto">
                Ready to start earning?
              </h2>
              <p className="mt-4 text-[15px] md:text-base text-muted-foreground max-w-xl mx-auto">
                Apply in under 2 minutes. Get approved in 24 hours. Start earning this week.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center sm:items-center">
                <Button
                  size="lg"
                  className="h-14 rounded-xl text-sm font-bold sm:px-10"
                  onClick={() => navigate("/driver-apply")}
                >
                  Apply in 4 minutes
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <a
                  href="tel:+18679888836"
                  className="inline-flex items-center justify-center px-4 py-3 text-sm font-semibold text-foreground/80 hover:text-foreground transition-colors"
                >
                  Questions? Call (867) 988-8836
                </a>
              </div>
            </motion.div>
          </div>
        </section>
      </main>
      <LandingFooter />
    </div>
  );
};

export default DriveLanding;
