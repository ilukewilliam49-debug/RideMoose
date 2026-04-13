import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, CalendarClock, Wallet, Layers, DollarSign, TrendingUp, Shield } from "lucide-react";
import driverHero from "@/assets/driver-hero.jpg";

const LandingDriver = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const perks = [
    { icon: CalendarClock, title: t("landing.drivePerkFlexible"), desc: t("landing.drivePerkFlexibleDesc") },
    { icon: Wallet, title: t("landing.drivePerkEarnings"), desc: t("landing.drivePerkEarningsDesc") },
    { icon: Layers, title: t("landing.drivePerkServices"), desc: t("landing.drivePerkServicesDesc") },
  ];

  const stats = [
    { icon: DollarSign, value: "95.1%", label: "You keep" },
    { icon: TrendingUp, value: "$1,200+", label: "Avg weekly" },
    { icon: Shield, value: "4.9%", label: "Low commission" },
  ];

  return (
    <section className="border-t border-border/30">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="grid gap-10 py-14 md:grid-cols-2 md:py-20 md:items-center">
          {/* Left — image */}
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45 }}
            className="relative overflow-hidden rounded-3xl"
          >
            <img
              src={driverHero}
              alt="PickYou driver"
              width={640}
              height={480}
              loading="lazy"
              className="h-[320px] w-full object-cover md:h-[420px]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/60 to-transparent" />
          </motion.div>

          {/* Right — content */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="space-y-6"
          >
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-primary mb-2">
                {t("landing.driveTitle")}
              </p>
              <h2 className="text-2xl font-black tracking-tight md:text-4xl">
                Earn on your own schedule
              </h2>
              <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground max-w-md">
                {t("landing.driveDesc")}
              </p>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2.5">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="flex flex-col items-center gap-1 rounded-2xl bg-card/60 ring-1 ring-border/30 px-3 py-4 text-center"
                >
                  <stat.icon className="h-4 w-4 text-primary mb-0.5" />
                  <span className="text-lg font-black tracking-tight">{stat.value}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {stat.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Perks */}
            <div className="space-y-2.5">
              {perks.map((perk) => (
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
              className="h-12 rounded-xl text-sm font-bold w-full sm:w-auto sm:px-8"
              onClick={() => navigate("/login?role=driver")}
            >
              {t("landing.driveApply")}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default LandingDriver;
