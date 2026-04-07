import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";
import { Car, Package, ChevronRight, ArrowRight, Plane, Briefcase } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

const DashboardHome = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const firstName = profile?.full_name?.split(" ")[0] || "";
  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? t("dashboard.goodMorning") : hour < 18 ? t("dashboard.goodAfternoon") : t("dashboard.goodEvening");
  const greeting = firstName
    ? `${timeGreeting}, ${firstName}`
    : timeGreeting;

  const services = [
    { icon: Car, label: t("dashboard.localTaxi"), desc: t("dashboard.localTaxiDesc"), path: "/rider/rides?service=taxi" },
    { icon: Briefcase, label: t("dashboard.privateHire"), desc: t("dashboard.privateHireDesc"), path: "/rider/rides?service=private_hire" },
    { icon: Plane, label: t("dashboard.airportRides"), desc: t("dashboard.airportRidesDesc"), path: "/rider/rides?service=private_hire" },
    { icon: Package, label: t("dashboard.delivery"), desc: t("dashboard.deliveryDesc"), path: "/rider/rides?service=courier" },
  ];

  return (
    <div className="space-y-10 pt-2 pb-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/80">{t("nav.dashboard")}</p>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{greeting}</h1>
          <p className="text-muted-foreground text-sm mt-1.5">{t("dashboard.whatDoYouNeed")}</p>
        </div>
        <div className="flex items-center gap-3 pt-1">
          <Button onClick={() => navigate("/rider/rides")} className="rounded-full px-6 font-semibold shadow-[var(--shadow-gold)]">
            {t("rider.requestARide")}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button variant="ghost" onClick={() => navigate("/rider/rides")} className="text-muted-foreground hover:text-foreground font-medium">
            {t("rider.recentRides")}
          </Button>
        </div>
      </motion.div>

      {/* Quick Actions */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15, duration: 0.4 }} className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-muted-foreground">{t("dashboard.quickActions")}</h2>
        <div className="grid grid-cols-2 gap-4">
          {services.map((service, i) => (
            <motion.button
              key={service.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.07, duration: 0.35 }}
              onClick={() => navigate(service.path)}
              className="group relative flex flex-col justify-between rounded-[20px] border border-border/40 bg-gradient-to-br from-card to-card/80 p-5 text-left transition-all duration-200 hover:border-primary/30 hover:shadow-[0_2px_24px_-4px_hsl(45_95%_55%/0.12)] min-h-[140px]"
              style={{ boxShadow: "inset 0 1px 1px 0 hsl(0 0% 100% / 0.04), 0 2px 12px -4px hsl(0 0% 0% / 0.3)" }}
            >
              <div className="flex items-start justify-between w-full">
                <service.icon className="h-7 w-7 text-primary shrink-0" />
                <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary/70 transition-colors mt-0.5" />
              </div>
              <div className="mt-auto pt-3">
                <h3 className="text-base font-bold leading-tight">{service.label}</h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">{service.desc}</p>
              </div>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default DashboardHome;
