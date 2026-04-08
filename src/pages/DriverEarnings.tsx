import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
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
  ArrowUpRight,
  Loader2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { format, startOfMonth, startOfWeek, eachDayOfInterval, isSameDay, addDays } from "date-fns";
import { useTranslation } from "react-i18next";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { fmt } from "@/lib/driver-constants";
import { serviceLabels } from "@/lib/driver-constants";

type Preset = "today" | "thisWeek" | "thisMonth" | "allTime";

const DriverEarnings = () => {
  const { profile } = useAuth();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [preset, setPreset] = useState<Preset>("today");
  const [showHistory, setShowHistory] = useState(true);
  const [showPayoutConfirm, setShowPayoutConfirm] = useState(false);

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
  const weekDays = eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) });

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

  // Payout requests
  const { data: payoutRequests } = useQuery({
    queryKey: ["payout-requests", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data, error } = await supabase
        .from("payout_requests")
        .select("*")
        .eq("driver_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.id,
  });

  const hasPendingPayout = payoutRequests?.some((p: any) => p.status === "pending");

  const requestPayout = useMutation({
    mutationFn: async () => {
      if (!profile?.id) throw new Error("No profile");
      if (balance <= 0) throw new Error("No balance to withdraw");
      const { error } = await supabase
        .from("payout_requests")
        .insert({ driver_id: profile.id, amount_cents: balance } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Payout request submitted");
      setShowPayoutConfirm(false);
      qc.invalidateQueries({ queryKey: ["payout-requests"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

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

      {/* Balance card + Payout */}
      <div className="rounded-2xl bg-card ring-1 ring-border/50 px-4 py-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <CreditCard className="h-4 w-4 text-primary" />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Account balance</p>
              <p className={`text-lg font-bold tabular-nums ${balance >= 0 ? "text-green-500" : "text-amber-500"}`}>
                {fmt(balance)}
              </p>
            </div>
          </div>
          {balance > 0 && !hasPendingPayout && !showPayoutConfirm && (
            <Button
              size="sm"
              className="gap-1.5 h-9"
              onClick={() => setShowPayoutConfirm(true)}
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
              Request payout
            </Button>
          )}
          {hasPendingPayout && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-amber-500">
              <Clock className="h-3.5 w-3.5" />
              Payout pending
            </span>
          )}
        </div>

        {/* Payout confirmation */}
        <AnimatePresence>
          {showPayoutConfirm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="rounded-xl bg-secondary/50 p-3 space-y-2.5">
                <p className="text-sm">
                  Request withdrawal of <span className="font-bold">{fmt(balance)}</span>?
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Payouts are typically processed within 1–3 business days.
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 h-10"
                    onClick={() => requestPayout.mutate()}
                    disabled={requestPayout.isPending}
                  >
                    {requestPayout.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Confirm"
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 h-10"
                    onClick={() => setShowPayoutConfirm(false)}
                    disabled={requestPayout.isPending}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Recent payout requests */}
        {payoutRequests && payoutRequests.length > 0 && (
          <div className="border-t border-border/50 pt-2.5 space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Payout history
            </p>
            {payoutRequests.map((pr: any) => (
              <div key={pr.id} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  {pr.status === "paid" && <CheckCircle2 className="h-3 w-3 text-green-500" />}
                  {pr.status === "pending" && <Clock className="h-3 w-3 text-amber-500" />}
                  {pr.status === "approved" && <CheckCircle2 className="h-3 w-3 text-primary" />}
                  {pr.status === "rejected" && <XCircle className="h-3 w-3 text-destructive" />}
                  <span className="font-medium tabular-nums">{fmt(pr.amount_cents)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-semibold uppercase ${
                    pr.status === "paid" ? "text-green-500" :
                    pr.status === "pending" ? "text-amber-500" :
                    pr.status === "approved" ? "text-primary" :
                    "text-destructive"
                  }`}>
                    {pr.status}
                  </span>
                  <span className="text-muted-foreground text-[10px]">
                    {format(new Date(pr.created_at), "MMM d")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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

      {/* Weekly earnings chart */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl bg-card ring-1 ring-border/50 p-4"
      >
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="h-4 w-4 text-primary" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            This week
          </span>
        </div>
        <div className="h-40">
          {chartData.every((d) => d.earnings === 0) ? (
            <div className="flex flex-col items-center justify-center h-full">
              <BarChart3 className="h-8 w-8 text-muted-foreground/20 mb-2" />
              <p className="text-sm text-muted-foreground">No earnings yet this week</p>
              <p className="text-[10px] text-muted-foreground/60 mt-0.5">Complete trips to see your chart</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barCategoryGap="20%">
                <XAxis
                  dataKey="day"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickFormatter={(v) => `$${v}`}
                  width={40}
                />
                <Tooltip
                  cursor={{ fill: "hsl(var(--accent) / 0.3)" }}
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "12px",
                    fontSize: "12px",
                  }}
                  formatter={(value: number) => [`$${value.toFixed(2)}`, "Earnings"]}
                />
                <Bar dataKey="earnings" radius={[6, 6, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.isToday ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.3)"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </motion.div>

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
                {/* Per-trip breakdown */}
                <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground tabular-nums">
                  <span>Fare: {fmt(ride.final_fare_cents || 0)}</span>
                  <span>Commission: {fmt(ride.commission_cents || 0)}</span>
                  {ride.stripe_fee_cents > 0 && <span>Fees: {fmt(ride.stripe_fee_cents)}</span>}
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
