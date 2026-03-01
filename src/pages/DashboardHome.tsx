import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";
import { Car, DollarSign, Clock, ShoppingCart, Package, UtensilsCrossed, PawPrint, ChevronRight, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const DashboardHome = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const firstName = profile?.full_name?.split(" ")[0] || "";
  const greeting = firstName
    ? t("dashboard.welcome", { name: firstName })
    : t("dashboard.welcomeDefault");

  const { data: rideStats } = useQuery({
    queryKey: ["rider-stats", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;
      const { data, error } = await supabase
        .from("rides")
        .select("id, final_fare_cents, created_at, started_at, status")
        .eq("rider_id", profile.id)
        .eq("status", "completed");
      if (error) throw error;

      const count = data?.length ?? 0;
      const totalCents = data?.reduce((sum, r) => sum + (r.final_fare_cents ?? 0), 0) ?? 0;

      // Avg wait = time between ride creation and driver starting the trip
      const waits = data
        ?.filter((r) => r.created_at && r.started_at)
        .map((r) => (new Date(r.started_at!).getTime() - new Date(r.created_at).getTime()) / 60000) ?? [];
      const avgWaitMin = waits.length > 0 ? waits.reduce((a, b) => a + b, 0) / waits.length : null;

      return { count, totalCents, avgWaitMin };
    },
    enabled: !!profile?.id,
  });

  const services = [
    { icon: Car, label: t("dashboard.rides"), desc: t("dashboard.ridesDesc"), path: "/rider/rides" },
    { icon: UtensilsCrossed, label: t("dashboard.foodDelivery"), desc: t("dashboard.foodDeliveryDesc"), path: "/rider/food" },
    { icon: ShoppingCart, label: t("dashboard.personalShopper"), desc: t("dashboard.personalShopperDesc"), path: "/rider/rides?service=personal_shopper" },
    { icon: Package, label: t("dashboard.delivery"), desc: t("dashboard.deliveryDesc"), path: "/rider/rides?service=courier" },
    { icon: PawPrint, label: t("dashboard.petTransport"), desc: t("dashboard.petTransportDesc"), path: "/rider/rides?service=pet_transport" },
  ];

  const totalRides = rideStats?.count ?? 0;
  const totalSpent = rideStats ? `$${(rideStats.totalCents / 100).toFixed(2)}` : "$0.00";

  const avgWait = rideStats?.avgWaitMin != null
    ? `${Math.round(rideStats.avgWaitMin)} min`
    : "—";

  const stats = [
    { icon: Car, label: t("dashboard.totalRides"), value: String(totalRides) },
    { icon: DollarSign, label: t("dashboard.totalSpent"), value: totalSpent },
    { icon: Clock, label: t("dashboard.avgWait"), value: avgWait, helper: rideStats?.avgWaitMin == null ? t("dashboard.afterFirstRide") : undefined },
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

      {/* Overview Stats */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4, duration: 0.4 }} className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-muted-foreground">{t("dashboard.yourOverview")}</h2>
        <div className="grid grid-cols-3 gap-3">
          {stats.map((card, i) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + i * 0.08, duration: 0.3 }}
              className="rounded-2xl border border-border/30 bg-card/60 p-4"
              style={{ boxShadow: "inset 0 1px 1px 0 hsl(0 0% 100% / 0.03)" }}
            >
              <div className="flex items-center gap-2 mb-2">
                <card.icon className="h-4 w-4 text-primary/70" />
                <span className="text-[11px] font-medium text-muted-foreground truncate">{card.label}</span>
              </div>
              <p className="text-xl font-bold font-mono">{card.value}</p>
              {card.helper && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{card.helper}</p>}
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default DashboardHome;
