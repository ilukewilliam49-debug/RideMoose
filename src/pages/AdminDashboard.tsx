import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Shield, FileCheck, Users, BarChart3,
  MessageSquare, ArrowRight, DollarSign,
  AlertTriangle, Radio,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import ErrorRetry from "@/components/driver/ErrorRetry";
import TestRideFlowPanel from "@/components/admin/TestRideFlowPanel";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: stats, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-dashboard-stats"],
    queryFn: async () => {
      const [
        verificationsRes,
        usersRes,
        ridesRes,
        supportRes,
        revenueRes,
        driversOnlineRes,
      ] = await Promise.all([
        supabase
          .from("verifications")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true }),
        supabase
          .from("rides")
          .select("id", { count: "exact", head: true })
          .in("status", ["requested", "dispatched", "accepted", "in_progress"]),
        supabase
          .from("support_conversations")
          .select("id", { count: "exact", head: true })
          .in("status", ["open", "in_progress"]),
        supabase.rpc("get_total_revenue"),
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("role", "driver")
          .eq("is_available", true),
      ]);

      return {
        pendingVerifications: verificationsRes.count || 0,
        totalUsers: usersRes.count || 0,
        activeRides: ridesRes.count || 0,
        openSupport: supportRes.count || 0,
        totalRevenue: Number(revenueRes.data || 0),
        driversOnline: driversOnlineRes.count || 0,
      };
    },
    refetchInterval: 30000,
  });

  // Alerts query — stale rides, failed payments
  const { data: alerts } = useQuery({
    queryKey: ["admin-dashboard-alerts"],
    queryFn: async () => {
      const twoMinAgo = new Date(Date.now() - 120_000).toISOString();
      const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();

      const [staleRidesRes, failedPaymentsRes] = await Promise.all([
        supabase
          .from("rides")
          .select("id", { count: "exact", head: true })
          .eq("status", "requested")
          .lt("created_at", twoMinAgo),
        supabase
          .from("rides")
          .select("id", { count: "exact", head: true })
          .eq("payment_status", "failed")
          .gte("updated_at", oneHourAgo),
      ]);

      return {
        staleRides: staleRidesRes.count || 0,
        failedPayments: failedPaymentsRes.count || 0,
      };
    },
    refetchInterval: 30000,
  });

  // Realtime invalidation on rides and profiles changes
  useEffect(() => {
    const channel = supabase
      .channel("admin-dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "rides" }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin-dashboard-stats"] });
        queryClient.invalidateQueries({ queryKey: ["admin-dashboard-alerts"] });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin-dashboard-stats"] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const cards = [
    {
      title: "Drivers online",
      description: "Drivers currently available to accept ride requests.",
      value: stats?.driversOnline ?? 0,
      icon: Radio,
      path: "/admin/users",
      cta: "View drivers",
      format: "count" as const,
    },
    {
      title: "Open rides",
      description: "Monitor rides currently requested, dispatched, accepted, or in progress.",
      value: stats?.activeRides ?? 0,
      icon: BarChart3,
      path: "/admin/reports",
      cta: "Open reports",
      format: "count" as const,
    },
    {
      title: "Total revenue",
      description: "Sum of all completed ride fares across the platform.",
      value: stats?.totalRevenue ?? 0,
      icon: DollarSign,
      path: "/admin/reports",
      cta: "View reports",
      format: "currency" as const,
    },
    {
      title: "Driver verifications",
      description: "Review pending documents and approve or reject drivers.",
      value: stats?.pendingVerifications ?? 0,
      icon: FileCheck,
      path: "/admin/verifications",
      cta: "Open verifications",
      format: "count" as const,
    },
    {
      title: "User management",
      description: "Manage roles, driver capabilities, and account access.",
      value: stats?.totalUsers ?? 0,
      icon: Users,
      path: "/admin/users",
      cta: "Open users",
      format: "count" as const,
    },
    {
      title: "Support inbox",
      description: "Reply to customer conversations and resolve open cases.",
      value: stats?.openSupport ?? 0,
      icon: MessageSquare,
      path: "/admin/support",
      cta: "Open support",
      format: "count" as const,
    },
  ];

  const hasAlerts = alerts && (alerts.staleRides > 0 || alerts.failedPayments > 0);

  return (
    <div className="space-y-8 pt-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="space-y-3"
      >
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          <Shield className="h-3.5 w-3.5" />
          Admin console
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">PickYou admin dashboard</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            This is the internal operations area for approvals, reporting, support, pricing,
            zones, and bookings — not the rider booking experience.
          </p>
        </div>
      </motion.div>

      {/* Operational Alerts */}
      {hasAlerts && (
        <div className="space-y-2">
          {alerts.staleRides > 0 && (
            <motion.div
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3"
            >
              <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">{alerts.staleRides} ride{alerts.staleRides > 1 ? "s" : ""} waiting 2+ minutes with no driver</p>
                <p className="text-xs text-muted-foreground">These rides may need manual intervention or driver re-dispatch.</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => navigate("/admin/reports")}>View rides</Button>
            </motion.div>
          )}
          {alerts.failedPayments > 0 && (
            <motion.div
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3"
            >
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">{alerts.failedPayments} failed payment{alerts.failedPayments > 1 ? "s" : ""} in the last hour</p>
                <p className="text-xs text-muted-foreground">Check Stripe logs and rider payment methods.</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => navigate("/admin/reports")}>View reports</Button>
            </motion.div>
          )}
        </div>
      )}

      {isError ? (
        <ErrorRetry message="Failed to load dashboard stats" onRetry={() => refetch()} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-3xl border border-border/50 bg-card/70 p-6 space-y-4">
                  <div className="flex items-start justify-between">
                    <Skeleton className="h-12 w-12 rounded-2xl" />
                    <Skeleton className="h-9 w-16" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                  <Skeleton className="h-4 w-28" />
                </div>
              ))
            : cards.map((card, index) => (
                <motion.button
                  key={card.title}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.06, duration: 0.3 }}
                  onClick={() => navigate(card.path)}
                  className="rounded-3xl border border-border/50 bg-card/70 p-6 text-left transition-all hover:border-primary/30 hover:shadow-[0_10px_30px_-12px_hsl(var(--primary)/0.18)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                      <card.icon className="h-6 w-6" />
                    </div>
                    <span className="text-3xl font-black tabular-nums">
                      {card.format === "currency"
                        ? `$${card.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : card.value}
                    </span>
                  </div>
                  <div className="mt-5 space-y-2">
                    <h2 className="text-lg font-semibold">{card.title}</h2>
                    <p className="text-sm leading-6 text-muted-foreground">{card.description}</p>
                  </div>
                  <div className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-primary">
                    {card.cta}
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </motion.button>
              ))}
        </div>
      )}

      <TestRideFlowPanel />

      <div className="rounded-3xl border border-border/50 bg-secondary/20 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Quick admin actions</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Jump straight to the operational areas you're most likely to need.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => navigate("/admin/live-map")}>Live Map</Button>
            <Button variant="outline" onClick={() => navigate("/admin/bookings")}>Bookings</Button>
            <Button variant="outline" onClick={() => navigate("/admin/pricing")}>Pricing</Button>
            <Button variant="outline" onClick={() => navigate("/admin/zones")}>Hire Zones</Button>
            <Button variant="outline" onClick={() => navigate("/admin/corporate")}>Corporate</Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
