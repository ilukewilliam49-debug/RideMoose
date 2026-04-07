import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";
import { Car, Package, Plane, Briefcase, Clock, MapPin, Home as HomeIcon, Building2, ChevronRight, CalendarIcon } from "lucide-react";
import { format, addMinutes } from "date-fns";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AddressAutocomplete from "@/components/map/AddressAutocomplete";

type Tab = "rides" | "delivery";

const DashboardHome = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<Tab>("rides");
  const [destination, setDestination] = useState("");
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
  const [customDate, setCustomDate] = useState<Date | undefined>(undefined);
  const [customTime, setCustomTime] = useState("12:00");
  const [showCustom, setShowCustom] = useState(false);

  const scheduleLabel = scheduledAt
    ? format(scheduledAt, "MMM d, h:mm a")
    : t("dashboard.now");

  const handlePreset = (mins: number) => {
    setScheduledAt(addMinutes(new Date(), mins));
    setShowCustom(false);
    setScheduleOpen(false);
  };

  const handleNow = () => {
    setScheduledAt(null);
    setShowCustom(false);
    setScheduleOpen(false);
  };

  const handleCustomConfirm = () => {
    if (!customDate) return;
    const [h, m] = customTime.split(":").map(Number);
    const dt = new Date(customDate);
    dt.setHours(h, m, 0, 0);
    setScheduledAt(dt);
    setShowCustom(false);
    setScheduleOpen(false);
  };

  // Append scheduledAt param to any path
  const withSchedule = (path: string) => {
    if (!scheduledAt) return path;
    const sep = path.includes("?") ? "&" : "?";
    return `${path}${sep}scheduledAt=${scheduledAt.toISOString()}`;
  };

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

      {/* ── "Where to?" address field ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-center gap-2 rounded-full bg-card px-2 py-1"
        style={{ boxShadow: "0 1px 4px 0 hsl(0 0% 0%/0.15)" }}
      >
        <div className="flex-1 [&_input]:rounded-full [&_input]:border-0 [&_input]:bg-transparent [&_input]:shadow-none [&_input]:focus-visible:ring-0 [&_input]:focus-visible:ring-offset-0 [&_input]:text-[15px] [&_input]:font-semibold [&_input]:placeholder:text-muted-foreground">
          <AddressAutocomplete
            value={destination}
            onChange={(value, lat, lng) => {
              setDestination(value);
              if (lat && lng) {
                const base = activeTab === "delivery" ? "/rider/rides?service=courier" : "/rider/rides";
                const sep = base.includes("?") ? "&" : "?";
                const schedParam = scheduledAt ? `&scheduledAt=${scheduledAt.toISOString()}` : "";
                navigate(`${base}${sep}dropoff=${encodeURIComponent(value)}&dlat=${lat}&dlng=${lng}${schedParam}`);
              }
            }}
            placeholder={t("dashboard.whereTo")}
            iconColor="text-muted-foreground"
          />
        </div>
        <Popover open={scheduleOpen} onOpenChange={setScheduleOpen}>
          <PopoverTrigger asChild>
            <button className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 shrink-0 hover:bg-accent transition-colors">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold max-w-[100px] truncate">{scheduleLabel}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3" align="end">
            {!showCustom ? (
              <div className="space-y-1">
                <button onClick={handleNow} className={cn("w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors", !scheduledAt ? "bg-primary/10 text-primary" : "hover:bg-accent")}>
                  Now
                </button>
                {[10, 20, 30].map((m) => (
                  <button key={m} onClick={() => handlePreset(m)} className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-accent transition-colors">
                    In {m} mins
                  </button>
                ))}
                <button onClick={() => setShowCustom(true)} className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-accent transition-colors flex items-center gap-2">
                  <CalendarIcon className="h-3.5 w-3.5" />
                  Custom time
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <Calendar
                  mode="single"
                  selected={customDate}
                  onSelect={setCustomDate}
                  disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))}
                  className={cn("p-2 pointer-events-auto")}
                />
                <div className="flex items-center gap-2">
                  <Input
                    type="time"
                    value={customTime}
                    onChange={(e) => setCustomTime(e.target.value)}
                    className="flex-1"
                  />
                  <Button size="sm" onClick={handleCustomConfirm} disabled={!customDate}>
                    Set
                  </Button>
                </div>
                <button onClick={() => setShowCustom(false)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  ← Back
                </button>
              </div>
            )}
          </PopoverContent>
        </Popover>
      </motion.div>

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
