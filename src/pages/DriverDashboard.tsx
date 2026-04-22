import { useState, useCallback, useEffect } from "react";
import InstallAppPrompt from "@/components/InstallAppPrompt";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Radio,
  
  DollarSign,
  ArrowRight,
  MapPin,
  ChevronRight,
  Zap,
  TrendingUp,
  AlertTriangle,
  Power,
  Car,
  Star,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { serviceLabels, fmt } from "@/lib/driver-constants";
import { DashboardStatsSkeleton, RecentTripsSkeleton } from "@/components/driver/DriverDashboardSkeletons";
import ShiftSummaryDialog from "@/components/driver/ShiftSummaryDialog";
import ShiftStatusPanel from "@/components/driver/ShiftStatusPanel";
import DriverWelcomeFlow from "@/components/driver/DriverWelcomeFlow";

const DriverDashboard = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [togglingAvailability, setTogglingAvailability] = useState(false);
  const [shiftSummaryOpen, setShiftSummaryOpen] = useState(false);
  const [lastShiftStart, setLastShiftStart] = useState<string | null>(null);

  const isOnline = !!profile?.is_available;

  // Regulatory cap: City/HOS rules forbid more than 12 hours of continuous
  // driving. Enforced client-side (block + auto-offline) and server-side
  // (accept_ride RPC + auto_offline_overdue_shifts cron).
  const SHIFT_LIMIT_MS = 12 * 60 * 60 * 1000;

  // ─── Live-ticking online duration + 12h cap enforcement ───
  const [elapsedMs, setElapsedMs] = useState(0);
  const [shiftCapped, setShiftCapped] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      const onlineSince = profile?.went_online_at;
      if (!onlineSince) {
        setElapsedMs(0);
        setShiftCapped(false);
        return;
      }
      const diff = Date.now() - new Date(onlineSince).getTime();
      setElapsedMs(diff);

      // Enforce 12-hour cap: auto-offline + show summary, exactly once.
      if (diff >= SHIFT_LIMIT_MS && !shiftCapped && profile?.id) {
        setShiftCapped(true);
        (async () => {
          try {
            setLastShiftStart(onlineSince);
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
            await supabase
              .from("profiles")
              .update({ is_available: false, went_online_at: null })
              .eq("id", profile.id);
            if (!cancelled) {
              toast.error("12-hour shift limit reached", {
                description: "You've been taken offline. Please rest before starting a new shift.",
                duration: 10000,
              });
              setShiftSummaryOpen(true);
              queryClient.invalidateQueries({ queryKey: ["auth-profile"] });
            }
          } catch (e) {
            console.error("[shift-cap] auto-offline failed", e);
          }
        })();
      }
    };
    tick();
    // Tick every 30s normally, but every 5s in the final hour for a smoother countdown.
    const intervalMs =
      profile?.went_online_at &&
      Date.now() - new Date(profile.went_online_at).getTime() > SHIFT_LIMIT_MS - 60 * 60 * 1000
        ? 5_000
        : 30_000;
    const id = setInterval(tick, intervalMs);
    return () => { cancelled = true; clearInterval(id); };
  }, [profile?.went_online_at, profile?.id, shiftCapped, queryClient, SHIFT_LIMIT_MS]);

  // ─── Toggle online / offline ───
  const toggleAvailability = useCallback(async () => {
    if (!profile?.id) return;

    // Block going online if onboarding is incomplete (defense-in-depth;
    // ProtectedRoute also gates the page, but this prevents a stale UI from
    // letting a driver flip online after their docs were revoked).
    const profileAny = profile as any;
    if (!isOnline && profileAny?.driver_onboarding_complete === false) {
      toast.error(
        "Finish driver onboarding before going online",
        { description: "Upload license, insurance & registration to start accepting trips." }
      );
      navigate("/driver/onboarding");
      return;
    }

    setTogglingAvailability(true);
    try {
      const newStatus = !isOnline;
      const updates: Record<string, any> = { is_available: newStatus };

      if (newStatus) {
        // Regulatory: refuse to go online if there's an unresolved shift
        // older than 12 hours — driver must rest before starting a new one.
        const { data: openSession } = await supabase
          .from("shift_sessions")
          .select("id, started_at")
          .eq("driver_id", profile.id)
          .is("ended_at", null)
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (openSession?.started_at) {
          const age = Date.now() - new Date(openSession.started_at).getTime();
          if (age >= SHIFT_LIMIT_MS) {
            await supabase
              .from("shift_sessions")
              .update({ ended_at: new Date().toISOString() })
              .eq("id", openSession.id);
            toast.error("12-hour shift limit reached", {
              description: "Please rest before starting a new shift.",
            });
            setTogglingAvailability(false);
            return;
          }
        }

        updates.went_online_at = new Date().toISOString();
        setShiftCapped(false);
        await supabase.from("shift_sessions").insert({
          driver_id: profile.id,
          started_at: new Date().toISOString(),
        });
      } else {
        // Show shift summary before clearing
        setLastShiftStart(profile.went_online_at || null);
        updates.went_online_at = null;
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
        setShiftSummaryOpen(true);
      }

      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", profile.id);
      if (error) throw error;

      if (newStatus) toast.success("You're online — ready for dispatch");
      queryClient.invalidateQueries({ queryKey: ["auth-profile"] });
    } catch {
      toast.error("Failed to update availability");
    } finally {
      setTogglingAvailability(false);
    }
  }, [profile, isOnline, queryClient, navigate, SHIFT_LIMIT_MS]);

  // ─── Dashboard stats ───
  const { data: stats, isLoading: statsLoading } = useQuery({
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
            .in("status", ["accepted", "arrived", "in_progress"])
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
            .eq("payment_status", "partial"),
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
    refetchInterval: 30000, // Fallback polling, Realtime handles most updates
  });

  // ─── Realtime subscription for instant dashboard updates ───
  useEffect(() => {
    if (!profile?.id) return;
    const channel = supabase
      .channel(`driver-dashboard-${profile.id}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "rides",
        filter: `driver_id=eq.${profile.id}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["driver-dashboard-stats"] });
        queryClient.invalidateQueries({ queryKey: ["driver-recent-trips"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient, profile?.id]);

  // ─── Driver rating + acceptance rate ───
  // Use cached average_rating from profile instead of computing client-side
  const profileAny = profile as any;
  const ratingData = profileAny?.average_rating != null
    ? { average: Number(profileAny.average_rating), count: profileAny.total_ratings ?? 0 }
    : null;

  const { data: acceptanceRate } = useQuery({
    queryKey: ["driver-acceptance-rate", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;
      // Count completed + cancelled (declined) rides assigned to this driver
      const [completedRes, cancelledRes] = await Promise.all([
        supabase.from("rides").select("id", { count: "exact", head: true }).eq("driver_id", profile.id).eq("status", "completed"),
        supabase.from("rides").select("id", { count: "exact", head: true }).eq("driver_id", profile.id).eq("status", "cancelled"),
      ]);
      const completed = completedRes.count || 0;
      const cancelled = cancelledRes.count || 0;
      const total = completed + cancelled;
      if (total === 0) return null;
      return Math.round((completed / total) * 100);
    },
    enabled: !!profile?.id,
    staleTime: 120_000,
  });

  // ─── Recent completed trips ───
  const { data: recentTrips, isLoading: tripsLoading } = useQuery({
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

  const activeRide = stats?.activeRide;

  return (
    <div className="space-y-4 pb-6">
      <InstallAppPrompt />
      {/* ── Status header ── */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Driver
          </p>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight">
              {profile?.full_name?.split(" ")[0] || "Driver"}
            </h1>
            {ratingData && (
              <span className="flex items-center gap-1 text-sm font-semibold text-amber-500">
                <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                {ratingData.average}
              </span>
            )}
            {acceptanceRate !== null && acceptanceRate !== undefined && (
              <span className="text-[10px] font-semibold text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                {acceptanceRate}% accept
              </span>
            )}
          </div>
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

      {/* ── Shift status panel (12-hour HOS cap) ── */}
      <ShiftStatusPanel
        isOnline={isOnline}
        elapsedMs={elapsedMs}
        limitMs={SHIFT_LIMIT_MS}
        capped={shiftCapped}
        toggling={togglingAvailability}
        onGoOffline={toggleAvailability}
      />

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
      {statsLoading ? (
        <DashboardStatsSkeleton />
      ) : (
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
      )}

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

      {/* ── Quick action: No active trip prompt ── */}
      {!activeRide && isOnline && !statsLoading && (
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
      {tripsLoading ? (
        <RecentTripsSkeleton />
      ) : recentTrips && recentTrips.length > 0 ? (
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
            {recentTrips.map((ride) => (
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
      ) : null}

      {/* Shift summary dialog */}
      <ShiftSummaryDialog
        open={shiftSummaryOpen}
        onClose={() => setShiftSummaryOpen(false)}
        profileId={profile?.id}
        shiftStartedAt={lastShiftStart}
      />

      {/* First-time approved-driver welcome */}
      <DriverWelcomeFlow />
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

export default DriverDashboard;
