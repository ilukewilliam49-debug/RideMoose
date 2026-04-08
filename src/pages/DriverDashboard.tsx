import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Radio,
  Clock3,
  DollarSign,
  ArrowRight,
  MapPin,
  ChevronRight,
  Zap,
  TrendingUp,
  AlertTriangle,
  Power,
  Car,
  Package,
  Briefcase,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";

const DriverDashboard = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [togglingAvailability, setTogglingAvailability] = useState(false);

  const isOnline = !!profile?.is_available;

  // ─── Toggle online / offline ───
  const toggleAvailability = useCallback(async () => {
    if (!profile?.id) return;
    setTogglingAvailability(true);
    try {
      const newStatus = !isOnline;
      const updates: Record<string, any> = { is_available: newStatus };

      if (newStatus) {
        updates.went_online_at = new Date().toISOString();
        // Start shift session
        await supabase.from("shift_sessions").insert({
          driver_id: profile.id,
          started_at: new Date().toISOString(),
        });
      } else {
        updates.went_online_at = null;
        // End open shift session
        const { data: openSession } = await supabase
          .from("shift_sessions")
          .select("id")
          .eq("driver_id", profile.id)
          .is("ended_at", null)
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (openSession) {
          await supabase
            .from("shift_sessions")
            .update({ ended_at: new Date().toISOString() })
            .eq("id", openSession.id);
        }
      }

      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", profile.id);
      if (error) throw error;

      toast.success(newStatus ? "You're online — ready for dispatch" : "You're offline");
      queryClient.invalidateQueries({ queryKey: ["auth-profile"] });
    } catch {
      toast.error("Failed to update availability");
    } finally {
      setTogglingAvailability(false);
    }
  }, [profile, isOnline, queryClient]);

  // ─── Dashboard stats ───
  const { data: stats } = useQuery({
    queryKey: ["driver-dashboard-stats", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;

      const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();

      const [activeRideRes, pendingRes, completedTodayRes, earningsTodayRes, outstandingRes] =
        await Promise.all([
          supabase
            .from("rides")
            .select("id, status, pickup_address, dropoff_address, service_type, created_at")
            .eq("driver_id", profile.id)
            .in("status", ["accepted", "in_progress"])
            .limit(1)
            .maybeSingle(),
          supabase
            .from("rides")
            .select("id", { count: "exact", head: true })
            .in("status", ["requested", "dispatched"]),
          supabase
            .from("rides")
            .select("id", { count: "exact", head: true })
            .eq("driver_id", profile.id)
            .eq("status", "completed")
            .gte("completed_at", todayStart),
          supabase
            .from("rides")
            .select("driver_earnings_cents")
            .eq("driver_id", profile.id)
            .eq("status", "completed")
            .gte("completed_at", todayStart),
          supabase
            .from("rides")
            .select("outstanding_amount_cents")
            .eq("driver_id", profile.id)
            .eq("status", "completed")
            .or("payment_status.eq.partial,and(payment_option.eq.pay_driver,payment_status.eq.unpaid)"),
        ]);

      const earningsToday = (earningsTodayRes.data || []).reduce(
        (sum: number, r: any) => sum + (r.driver_earnings_cents || 0),
        0
      );
      const outstandingTotal = (outstandingRes.data || []).reduce(
        (sum: number, r: any) => sum + (r.outstanding_amount_cents || 0),
        0
      );

      return {
        activeRide: activeRideRes.data || null,
        pendingCount: pendingRes.count || 0,
        completedToday: completedTodayRes.count || 0,
        earningsToday,
        outstandingTotal,
      };
    },
    enabled: !!profile?.id,
    refetchInterval: 8000,
  });

  // Recent completed trips
  const { data: recentTrips } = useQuery({
    queryKey: ["driver-recent-trips", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data, error } = await supabase
        .from("rides")
        .select("id, pickup_address, dropoff_address, service_type, driver_earnings_cents, completed_at")
        .eq("driver_id", profile.id)
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(5);
      if (error) return [];
      return data;
    },
    enabled: !!profile?.id,
  });

  // ─── Online duration ───
  const onlineSince = profile?.went_online_at;
  const onlineDuration = onlineSince
    ? (() => {
        const diff = Date.now() - new Date(onlineSince).getTime();
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        return h > 0 ? `${h}h ${m}m` : `${m}m`;
      })()
    : null;

  const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const activeRide = stats?.activeRide;

  const serviceLabels: Record<string, string> = {
    taxi: "Taxi",
    private_hire: "Private Hire",
    courier: "Courier",
    large_delivery: "Large Delivery",
    retail_delivery: "Retail",
    personal_shopper: "Shopper",
    food_delivery: "Food",
    pet_transport: "Pet Transport",
    shuttle: "Shuttle",
  };

  return (
    <div className="space-y-4 pb-6">
      {/* ── Status header ── */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Driver
          </p>
          <h1 className="text-xl font-bold tracking-tight">
            {profile?.full_name?.split(" ")[0] || "Driver"}
          </h1>
        </div>
        <button
          onClick={toggleAvailability}
          disabled={togglingAvailability}
          className={`
            relative flex h-14 w-14 items-center justify-center rounded-2xl
            transition-all duration-200 active:scale-95
            ${isOnline
              ? "bg-green-500/15 text-green-500 ring-1 ring-green-500/30"
              : "bg-muted text-muted-foreground ring-1 ring-border"
            }
          `}
          aria-label={isOnline ? "Go offline" : "Go online"}
        >
          <Power className="h-6 w-6" />
          {isOnline && (
            <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-background bg-green-500" />
          )}
        </button>
      </div>

      {/* ── Online status strip ── */}
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        className={`
          flex items-center justify-between rounded-2xl px-4 py-3
          ${isOnline
            ? "bg-green-500/10 ring-1 ring-green-500/20"
            : "bg-muted/50 ring-1 ring-border/50"
          }
        `}
      >
        <div className="flex items-center gap-3">
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              isOnline ? "bg-green-500 animate-pulse" : "bg-muted-foreground"
            }`}
          />
          <span className="text-sm font-semibold">
            {isOnline ? "Online — accepting trips" : "Offline"}
          </span>
        </div>
        {isOnline && onlineDuration && (
          <span className="text-xs font-medium text-muted-foreground">
            <Clock3 className="mr-1 inline h-3 w-3" />
            {onlineDuration}
          </span>
        )}
      </motion.div>

      {/* ── Active trip banner ── */}
      {activeRide && (
        <motion.button
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={() => navigate("/driver/dispatch")}
          className="w-full rounded-2xl bg-primary/10 ring-1 ring-primary/25 p-4 text-left active:scale-[0.98] transition-transform"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-primary">
                Active trip
              </span>
            </div>
            <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[11px] font-semibold text-primary">
              {serviceLabels[activeRide.service_type] || activeRide.service_type}
            </span>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-500" />
              <p className="text-sm font-medium leading-tight line-clamp-1">
                {activeRide.pickup_address}
              </p>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <p className="text-sm font-medium leading-tight line-clamp-1">
                {activeRide.dropoff_address}
              </p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1 text-xs font-semibold text-primary">
            Manage trip
            <ArrowRight className="h-3.5 w-3.5" />
          </div>
        </motion.button>
      )}

      {/* ── Stats grid ── */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Earnings today"
          value={fmt(stats?.earningsToday ?? 0)}
          icon={<DollarSign className="h-4 w-4" />}
          color="text-green-500"
        />
        <StatCard
          label="Trips today"
          value={String(stats?.completedToday ?? 0)}
          icon={<TrendingUp className="h-4 w-4" />}
          color="text-primary"
        />
      </div>

      {/* ── Dispatch CTA ── */}
      <motion.button
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        onClick={() => navigate("/driver/dispatch")}
        className="flex w-full items-center justify-between rounded-2xl bg-card ring-1 ring-border/50 px-4 py-4 text-left active:scale-[0.98] transition-transform"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Radio className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">Dispatch board</p>
            <p className="text-xs text-muted-foreground">
              {stats?.pendingCount
                ? `${stats.pendingCount} request${stats.pendingCount > 1 ? "s" : ""} waiting`
                : "No pending requests"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(stats?.pendingCount ?? 0) > 0 && (
            <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground">
              {stats?.pendingCount}
            </span>
          )}
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </motion.button>

      {/* ── Outstanding balance ── */}
      {(stats?.outstandingTotal ?? 0) > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="flex items-center gap-3 rounded-2xl bg-amber-500/8 ring-1 ring-amber-500/20 px-4 py-3"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Outstanding balance</p>
            <p className="text-xs text-muted-foreground">
              Cash collections or partial payments to settle
            </p>
          </div>
          <span className="text-sm font-bold text-amber-500 tabular-nums">
            {fmt(stats!.outstandingTotal)}
          </span>
        </motion.div>
      )}

      {/* ── Service capabilities ── */}
      {(profile?.can_taxi || profile?.can_private_hire || profile?.can_courier || profile?.can_food_delivery || profile?.pet_approved) ? (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground px-1">
            Your services
          </p>
          <div className="flex flex-wrap gap-2">
            {profile?.can_taxi && <ServiceBadge label="Taxi" />}
            {profile?.can_private_hire && <ServiceBadge label="Private Hire" />}
            {profile?.can_shuttle && <ServiceBadge label="Shuttle" />}
            {profile?.can_courier && <ServiceBadge label="Courier" />}
            {profile?.can_food_delivery && <ServiceBadge label="Food Delivery" />}
            {profile?.pet_approved && <ServiceBadge label="Pet Transport" />}
            {profile?.vehicle_type && <ServiceBadge label={profile.vehicle_type} />}
            {profile?.seat_capacity && (
              <ServiceBadge label={`${profile.seat_capacity} seats`} />
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-2xl bg-amber-500/8 ring-1 ring-amber-500/20 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <div>
            <p className="text-sm font-semibold">No services enabled</p>
            <p className="text-xs text-muted-foreground">
              Contact admin to enable your driver capabilities.
            </p>
          </div>
        </div>
      )}

      {/* ── Quick action: No active trip prompt ── */}
      {!activeRide && isOnline && (
        <div className="rounded-2xl bg-card/50 ring-1 ring-border/30 p-4 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/5 mx-auto mb-2">
            <Car className="h-4 w-4 text-muted-foreground/40" />
          </div>
          <p className="text-sm text-muted-foreground">
            You're online and waiting for trips
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 text-xs text-primary"
            onClick={() => navigate("/driver/dispatch")}
          >
            Check dispatch board
            <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* ── Recent trips ── */}
      {recentTrips && recentTrips.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Recent trips
            </h2>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-primary h-auto p-0"
              onClick={() => navigate("/driver/earnings")}
            >
              View all <ChevronRight className="ml-0.5 h-3 w-3" />
            </Button>
          </div>
          <div className="space-y-2">
            {recentTrips.map((ride: any) => (
              <div
                key={ride.id}
                className="flex items-center justify-between rounded-2xl bg-card ring-1 ring-border/50 px-4 py-3"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="text-[9px] font-bold uppercase tracking-wider bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded shrink-0">
                    {serviceLabels[ride.service_type] || ride.service_type}
                  </span>
                  <p className="text-xs text-muted-foreground truncate">
                    {ride.pickup_address?.split(",")[0]} → {ride.dropoff_address?.split(",")[0]}
                  </p>
                </div>
                <span className="text-sm font-bold tabular-nums text-green-500 shrink-0 ml-2">
                  {fmt(ride.driver_earnings_cents || 0)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Stat card component ───
function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-card ring-1 ring-border/50 p-4"
    >
      <div className="flex items-center gap-2 mb-2">
        <span className={color}>{icon}</span>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      </div>
      <p className={`text-2xl font-bold tabular-nums tracking-tight ${color}`}>
        {value}
      </p>
    </motion.div>
  );
}

// ─── Service badge ───
function ServiceBadge({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-secondary ring-1 ring-border/50 px-3 py-1.5 text-xs font-medium text-secondary-foreground">
      {label}
    </span>
  );
}

export default DriverDashboard;
