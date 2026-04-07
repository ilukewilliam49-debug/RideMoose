import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";
import { Car, Package, Plane, Briefcase, Search, Clock, MapPin, Home as HomeIcon, Building2, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type Tab = "rides" | "delivery";

const DashboardHome = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<Tab>("rides");

  // Fetch saved places
  const { data: savedPlaces } = useQuery({
    queryKey: ["saved-places", profile?.user_id],
    queryFn: async () => {
      if (!profile?.user_id) return [];
      const { data, error } = await supabase
        .from("saved_places")
        .select("*")
        .eq("user_id", profile.user_id)
        .order("sort_order", { ascending: true })
        .limit(3);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!profile?.user_id,
  });

  const suggestions =
    activeTab === "rides"
      ? [
          { icon: Car, label: t("dashboard.localTaxi"), path: "/rider/rides?service=taxi" },
          { icon: Briefcase, label: t("dashboard.privateHire"), path: "/rider/rides?service=private_hire" },
          { icon: Plane, label: t("dashboard.airportRides"), path: "/rider/rides?service=private_hire" },
        ]
      : [
          { icon: Package, label: t("dashboard.delivery"), path: "/rider/rides?service=courier" },
        ];

  const placeIcon = (icon: string) => {
    if (icon === "home") return HomeIcon;
    if (icon === "work" || icon === "briefcase") return Building2;
    return MapPin;
  };

  return (
    <div className="pb-8">
      {/* ── Top tabs ── */}
      <div className="flex items-center gap-6 pb-5">
        <button
          onClick={() => setActiveTab("rides")}
          className={`flex items-center gap-2 pb-1 text-[15px] font-bold transition-colors ${
            activeTab === "rides"
              ? "text-foreground border-b-2 border-foreground"
              : "text-muted-foreground"
          }`}
        >
          <Car className="h-5 w-5" />
          {t("dashboard.rides")}
        </button>
        <button
          onClick={() => setActiveTab("delivery")}
          className={`flex items-center gap-2 pb-1 text-[15px] font-bold transition-colors ${
            activeTab === "delivery"
              ? "text-foreground border-b-2 border-foreground"
              : "text-muted-foreground"
          }`}
        >
          <Package className="h-5 w-5" />
          {t("dashboard.delivery")}
        </button>
      </div>

      {/* ── "Where to?" search bar ── */}
      <motion.button
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        onClick={() => navigate("/rider/rides" + (activeTab === "delivery" ? "?service=courier" : ""))}
        className="flex w-full items-center gap-3 rounded-full bg-card px-5 py-3.5 text-left transition-colors hover:bg-accent active:scale-[0.99]"
        style={{ boxShadow: "0 1px 4px 0 hsl(0 0% 0%/0.15)" }}
      >
        <Search className="h-5 w-5 text-muted-foreground shrink-0" />
        <span className="flex-1 text-[15px] font-semibold text-muted-foreground">
          {t("dashboard.whereTo")}
        </span>
        <div className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold">{t("dashboard.now")}</span>
        </div>
      </motion.button>

      {/* ── Saved places ── */}
      {savedPlaces && savedPlaces.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.3 }}
          className="mt-4 divide-y divide-border/30"
        >
          {savedPlaces.map((place) => {
            const Icon = placeIcon(place.icon);
            return (
              <button
                key={place.id}
                onClick={() =>
                  navigate(
                    `/rider/rides?pickup=${encodeURIComponent(place.address)}`
                  )
                }
                className="flex w-full items-center gap-4 py-3.5 text-left hover:bg-accent/30 transition-colors -mx-1 px-1 rounded-lg"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary">
                  <Icon className="h-4 w-4 text-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-semibold leading-tight">{place.label}</p>
                  <p className="text-[13px] text-muted-foreground truncate mt-0.5">{place.address}</p>
                </div>
              </button>
            );
          })}
        </motion.div>
      )}

      {/* ── Divider ── */}
      <div className="my-5 h-px bg-border/30" />

      {/* ── Suggestions ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.3 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-black tracking-tight">{t("dashboard.suggestions")}</h2>
          <button
            onClick={() => navigate("/rider/rides")}
            className="text-[13px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            {t("dashboard.seeAll")}
          </button>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
          {suggestions.map((item) => (
            <button
              key={item.label}
              onClick={() => navigate(item.path)}
              className="flex flex-col items-center gap-2 shrink-0 active:scale-[0.96] transition-transform"
            >
              <div className="flex h-[72px] w-[72px] items-center justify-center rounded-2xl bg-card border border-border/30">
                <item.icon className="h-7 w-7 text-primary" />
              </div>
              <span className="text-[12px] font-semibold text-center leading-tight max-w-[76px]">
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </motion.div>

      {/* ── Divider ── */}
      <div className="my-6 h-px bg-border/30" />

      {/* ── Quick access cards ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.3 }}
        className="space-y-3"
      >
        <h2 className="text-lg font-black tracking-tight">{t("dashboard.quickActions")}</h2>

        <button
          onClick={() => navigate("/rider/rides")}
          className="flex w-full items-center gap-4 rounded-2xl bg-card/60 p-4 text-left hover:bg-card transition-colors active:scale-[0.99]"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Car className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-bold">{t("rider.requestARide")}</p>
            <p className="text-[13px] text-muted-foreground mt-0.5">{t("dashboard.ridesDesc")}</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
        </button>

        <button
          onClick={() => navigate("/rider/rides?service=courier")}
          className="flex w-full items-center gap-4 rounded-2xl bg-card/60 p-4 text-left hover:bg-card transition-colors active:scale-[0.99]"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Package className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-bold">{t("dashboard.delivery")}</p>
            <p className="text-[13px] text-muted-foreground mt-0.5">{t("dashboard.deliveryDesc")}</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
        </button>
      </motion.div>
    </div>
  );
};

export default DashboardHome;
