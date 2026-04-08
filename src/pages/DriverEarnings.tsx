import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  DollarSign,
  TrendingUp,
  CreditCard,
  Percent,
  Gift,
  Car,
  Package,
  Briefcase,
  ChevronDown,
  ChevronUp,
  Clock,
  BarChart3,
} from "lucide-react";
import { format, startOfMonth, startOfWeek, subDays, eachDayOfInterval, isSameDay } from "date-fns";
import { useTranslation } from "react-i18next";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";

const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;

const serviceLabels: Record<string, string> = {
  taxi: "Taxi",
  private_hire: "Private Hire",
  shuttle: "Shuttle",
  courier: "Courier",
  large_delivery: "Large Delivery",
  retail_delivery: "Retail",
  personal_shopper: "Shopper",
  food_delivery: "Food",
  pet_transport: "Pet Transport",
};

type Preset = "today" | "thisWeek" | "thisMonth" | "allTime";

const DriverEarnings = () => {
  const { profile } = useAuth();
  const { t } = useTranslation();
  const [preset, setPreset] = useState<Preset>("today");
  const [showHistory, setShowHistory] = useState(true);

  const getRange = (p: Preset) => {
    const now = new Date();
    switch (p) {
      case "today":
        return new Date(now.setHours(0, 0, 0, 0)).toISOString();
      case "thisWeek":
        return startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString();
      case "thisMonth":
        return startOfMonth(new Date()).toISOString();
      case "allTime":
        return null;
    }
  };

  const rangeStart = getRange(preset);

  const { data: stats, isLoading } = useQuery({
    queryKey: ["driver-earnings-full", profile?.id, preset],
    queryFn: async () => {
      if (!profile?.id) return null;

      let query = supabase
        .from("rides")
        .select("driver_earnings_cents, commission_cents, stripe_fee_cents, final_fare_cents, service_type, completed_at, pickup_address, dropoff_address, status")
        .eq("driver_id", profile.id)
        .eq("status", "completed")
        .order("completed_at", { ascending: false });

      if (rangeStart) {
        query = query.gte("completed_at", rangeStart);
      }

      const { data: rides, error } = await query;
      if (error) throw error;

      const all = rides || [];
      const totalEarnings = all.reduce((sum, r) => sum + (r.driver_earnings_cents || 0), 0);
      const totalCommission = all.reduce((sum, r) => sum + (r.commission_cents || 0), 0);
      const totalStripeFees = all.reduce((sum, r) => sum + (r.stripe_fee_cents || 0), 0);
      const totalGross = all.reduce((sum, r) => sum + (r.final_fare_cents || 0), 0);

      return {
        totalEarnings,
        totalCommission,
        totalStripeFees,
        totalGross,
        tripCount: all.length,
        recentTrips: all.slice(0, 15),
      };
    },
    enabled: !!profile?.id,
  });

  // Weekly chart data
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: new Date() });

  const { data: weeklyRides } = useQuery({
    queryKey: ["driver-weekly-chart", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data, error } = await supabase
        .from("rides")
        .select("driver_earnings_cents, completed_at")
        .eq("driver_id", profile.id)
        .eq("status", "completed")
        .gte("completed_at", weekStart.toISOString())
        .order("completed_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.id,
  });

  const chartData = useMemo(() => {
    return weekDays.map((day) => {
      const dayEarnings = (weeklyRides || [])
        .filter((r: any) => r.completed_at && isSameDay(new Date(r.completed_at), day))
        .reduce((sum: number, r: any) => sum + (r.driver_earnings_cents || 0), 0);
      const isToday = isSameDay(day, new Date());
      return {
        day: format(day, "EEE"),
        earnings: dayEarnings / 100,
        isToday,
      };
    });
  }, [weeklyRides, weekDays]);

  // Commission ramp
  const launchStart = profile?.launch_start_date ? new Date(profile.launch_start_date) : null;
  const daysActive = launchStart ? (Date.now() - launchStart.getTime()) / 86400000 : Infinity;
  const phase = daysActive <= 30 ? 1 : daysActive <= 60 ? 2 : 3;
  const currentRate = phase === 1 ? 0 : phase === 2 ? 0.029 : 0.049;
  const inPromo = phase < 3;
  const daysLeft = phase === 1 ? Math.ceil(30 - daysActive) : phase === 2 ? Math.ceil(60 - daysActive) : 0;

  // Balance
  const balance = profile?.driver_balance_cents ?? 0;

  const presetButtons: { key: Preset; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "thisWeek", label: "This week" },
    { key: "thisMonth", label: "This month" },
    { key: "allTime", label: "All time" },
  ];

  return (
    <div className="space-y-4 pb-6">
      {/* Header */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Earnings
        </p>
        <h1 className="text-xl font-bold tracking-tight">Your income</h1>
      </div>

      {/* Commission promo banner */}
      {inPromo && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between rounded-2xl bg-green-500/8 ring-1 ring-green-500/20 px-4 py-3"
        >
          <div className="flex items-center gap-2.5">
            <Gift className="h-4 w-4 text-green-500" />
            <div>
              <p className="text-sm font-semibold">
                {phase === 1 ? "Launch period — 0% commission" : "Early driver — 2.9% commission"}
              </p>
              <p className="text-[10px] text-muted-foreground">{daysLeft} days remaining</p>
            </div>
          </div>
          <span className="text-xs font-bold text-green-500 tabular-nums">
            {(currentRate * 100).toFixed(1)}%
          </span>
        </motion.div>
      )}

      {/* Balance card */}
      {balance !== 0 && (
        <div className="flex items-center justify-between rounded-2xl bg-card ring-1 ring-border/50 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <CreditCard className="h-4 w-4 text-primary" />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Account balance</p>
              <p className={`text-lg font-bold tabular-nums ${balance >= 0 ? "text-green-500" : "text-amber-500"}`}>
                {fmt(balance)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Period selector */}
      <div className="flex gap-1.5">
        {presetButtons.map((p) => (
          <button
            key={p.key}
            onClick={() => setPreset(p.key)}
            className={`flex-1 rounded-xl py-2.5 text-xs font-semibold transition-colors active:scale-[0.98] ${
              preset === p.key
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3">
        <EarningsCard
          label="Net earnings"
          value={isLoading ? "…" : fmt(stats?.totalEarnings ?? 0)}
          icon={<DollarSign className="h-4 w-4" />}
          accent
        />
        <EarningsCard
          label="Trips"
          value={isLoading ? "…" : String(stats?.tripCount ?? 0)}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <EarningsCard
          label="Gross fares"
          value={isLoading ? "…" : fmt(stats?.totalGross ?? 0)}
          icon={<TrendingUp className="h-4 w-4" />}
          muted
        />
        <EarningsCard
          label="Fees & commission"
          value={isLoading ? "…" : fmt((stats?.totalCommission ?? 0) + (stats?.totalStripeFees ?? 0))}
          icon={<Percent className="h-4 w-4" />}
          muted
        />
      </div>

      {/* Recent trips */}
      <div>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="flex w-full items-center justify-between mb-3"
        >
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Recent trips
          </h2>
          {showHistory ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {showHistory && (
          <div className="space-y-2">
            {!stats?.recentTrips?.length && !isLoading && (
              <div className="rounded-2xl bg-card/50 ring-1 ring-border/30 p-6 text-center">
                <p className="text-sm text-muted-foreground">No completed trips yet</p>
              </div>
            )}
            {stats?.recentTrips?.map((ride: any, i: number) => (
              <motion.div
                key={ride.completed_at + i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="rounded-2xl bg-card ring-1 ring-border/50 p-3.5"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-semibold uppercase tracking-wider bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full shrink-0">
                      {serviceLabels[ride.service_type] || ride.service_type}
                    </span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {ride.completed_at
                        ? format(new Date(ride.completed_at), "MMM d, HH:mm")
                        : ""}
                    </span>
                  </div>
                  <span className="text-sm font-bold tabular-nums text-green-500">
                    {fmt(ride.driver_earnings_cents || 0)}
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex items-start gap-2">
                    <div className="mt-1 h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" />
                    <p className="text-xs text-muted-foreground line-clamp-1">{ride.pickup_address}</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                    <p className="text-xs text-muted-foreground line-clamp-1">{ride.dropoff_address}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground tabular-nums">
                  <span>Fare: {fmt(ride.final_fare_cents || 0)}</span>
                  <span>Commission: {fmt(ride.commission_cents || 0)}</span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

function EarningsCard({
  label,
  value,
  icon,
  accent,
  muted,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent?: boolean;
  muted?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-card ring-1 ring-border/50 p-4"
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span className={accent ? "text-green-500" : muted ? "text-muted-foreground" : "text-primary"}>
          {icon}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      </div>
      <p
        className={`text-2xl font-bold tabular-nums tracking-tight ${
          accent ? "text-green-500" : muted ? "text-muted-foreground" : "text-foreground"
        }`}
      >
        {value}
      </p>
    </motion.div>
  );
}

export default DriverEarnings;
