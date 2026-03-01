import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";
import { Car, MapPin, DollarSign, Clock, ShoppingCart, Package, UtensilsCrossed } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

const DashboardHome = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const services = [
    {
      icon: Car,
      label: t("dashboard.rides"),
      desc: t("dashboard.ridesDesc"),
      path: "/rider/rides",
      gradient: "from-primary/20 to-primary/5",
    },
    {
      icon: UtensilsCrossed,
      label: t("dashboard.foodDelivery"),
      desc: t("dashboard.foodDeliveryDesc"),
      path: "/rider/food",
      gradient: "from-orange-500/20 to-orange-500/5",
    },
    {
      icon: ShoppingCart,
      label: t("dashboard.personalShopper"),
      desc: t("dashboard.personalShopperDesc"),
      path: "/rider/rides?service=personal_shopper",
      gradient: "from-emerald-500/20 to-emerald-500/5",
    },
    {
      icon: Package,
      label: t("dashboard.delivery"),
      desc: t("dashboard.deliveryDesc"),
      path: "/rider/rides?service=courier",
      gradient: "from-amber-500/20 to-amber-500/5",
    },
  ];

  const greeting = profile?.full_name
    ? t("dashboard.welcome", { name: profile.full_name })
    : t("dashboard.welcomeDefault");

  const role = profile?.role || "rider";

  const stats: Record<string, { icon: any; label: string; value: string }[]> = {
    rider: [
      { icon: Car, label: t("dashboard.totalRides"), value: "—" },
      { icon: DollarSign, label: t("dashboard.totalSpent"), value: "—" },
      { icon: Clock, label: t("dashboard.avgWait"), value: "—" },
    ],
    driver: [
      { icon: Car, label: t("dashboard.tripsCompleted"), value: "—" },
      { icon: DollarSign, label: t("dashboard.earnings"), value: "—" },
      { icon: Clock, label: t("dashboard.hoursOnline"), value: "—" },
    ],
    admin: [
      { icon: Car, label: t("dashboard.activeRides"), value: "—" },
      { icon: MapPin, label: t("dashboard.onlineDrivers"), value: "—" },
      { icon: DollarSign, label: t("dashboard.revenueToday"), value: "—" },
    ],
  };

  const cards = stats[role] || stats.rider;

  return (
    <div className="space-y-8 pt-4">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold">{greeting}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t("dashboard.whatDoYouNeed")}</p>
      </motion.div>

      {/* Service Cards */}
      <div className="grid grid-cols-2 gap-4">
        {services.map((service, i) => (
          <motion.button
            key={service.label}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            onClick={() => navigate(service.path)}
            className={`glass-surface rounded-xl p-6 text-left transition-all hover:scale-[1.03] hover:shadow-lg bg-gradient-to-br ${service.gradient}`}
          >
            <service.icon className="h-8 w-8 text-primary mb-3" />
            <h3 className="text-lg font-semibold mb-1">{service.label}</h3>
            <p className="text-xs text-muted-foreground">{service.desc}</p>
          </motion.button>
        ))}
      </div>

      {/* Stats */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">{t("dashboard.yourOverview")}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {cards.map((card, i) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.1 }}
              className="glass-surface rounded-lg p-5"
            >
              <div className="flex items-center gap-3 mb-2">
                <card.icon className="h-5 w-5 text-primary" />
                <span className="text-sm text-muted-foreground">{card.label}</span>
              </div>
              <p className="text-2xl font-bold font-mono">{card.value}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DashboardHome;
