import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Car,
  Radio,
  Clock3,
  DollarSign,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import DriverEarningsSummary from "@/components/DriverEarningsSummary";

const DriverDashboard = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ["driver-dashboard-stats", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;

      const [
        activeRideRes,
        pendingDispatchRes,
        completedTodayRes,
        outstandingRes,
      ] = await Promise.all([
        supabase
          .from("rides")
          .select("id, status, pickup_address, dropoff_address", { head: false })
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
          .gte("completed_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
        supabase
          .from("rides")
          .select("outstanding_amount_cents")
          .eq("driver_id", profile.id)
          .eq("status", "completed")
          .or("payment_status.eq.partial,and(payment_option.eq.pay_driver,payment_status.eq.unpaid)"),
      ]);

      const outstandingTotal = (outstandingRes.data || []).reduce(
        (sum: number, ride: any) => sum + (ride.outstanding_amount_cents || 0),
        0
      );

      return {
        activeRide: activeRideRes.data || null,
        pendingDispatchCount: pendingDispatchRes.count || 0,
        completedToday: completedTodayRes.count || 0,
        outstandingTotal,
      };
    },
    enabled: !!profile?.id,
    refetchInterval: 10000,
  });

  const cards = [
    {
      title: "Dispatch board",
      description: "See incoming ride requests and manage your active trip.",
      value: stats?.pendingDispatchCount ?? 0,
      icon: Radio,
      path: "/driver/dispatch",
      cta: "Open dispatch",
    },
    {
      title: "Completed today",
      description: "Trips you’ve finished since midnight.",
      value: stats?.completedToday ?? 0,
      icon: CheckCircle2,
      path: "/driver/dispatch",
      cta: "View trip activity",
    },
    {
      title: "Outstanding balance",
      description: "Payments still due directly to you from completed rides.",
      value: `$${(((stats?.outstandingTotal ?? 0) as number) / 100).toFixed(2)}`,
      icon: DollarSign,
      path: "/driver/dispatch",
      cta: "Review balances",
    },
  ];

  const activeRide = stats?.activeRide;

  return (
    <div className="space-y-8 pt-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="space-y-3"
      >
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          <Car className="h-3.5 w-3.5" />
          Driver hub
        </div>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Driver dashboard</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Manage dispatch, stay on top of your active trip, and track your earnings from one place.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${profile?.is_available ? "bg-green-500/10 text-green-500" : "bg-muted text-muted-foreground"}`}>
              <span className={`h-2 w-2 rounded-full ${profile?.is_available ? "bg-green-500" : "bg-muted-foreground"}`} />
              {profile?.is_available ? "Available for dispatch" : "Offline / unavailable"}
            </div>
            <Button onClick={() => navigate("/driver/dispatch")}>
              Open dispatch
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </motion.div>

      {activeRide ? (
        <div className="rounded-3xl border border-primary/20 bg-primary/5 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-background px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-primary">
                <Clock3 className="h-3.5 w-3.5" />
                Active ride
              </div>
              <h2 className="text-xl font-semibold">{activeRide.pickup_address} → {activeRide.dropoff_address}</h2>
              <p className="text-sm text-muted-foreground">
                Current status: <span className="font-medium text-foreground">{String(activeRide.status).replace("_", " ")}</span>
              </p>
            </div>
            <Button onClick={() => navigate("/driver/dispatch")}>
              Manage active trip
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-3xl border border-border/50 bg-secondary/20 p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">No active trip right now</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Head to dispatch to check for incoming requests and start your next ride.
              </p>
            </div>
            <Button variant="outline" onClick={() => navigate("/driver/dispatch")}>
              Go to dispatch
            </Button>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((card, index) => (
          <motion.button
            key={card.title}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06, duration: 0.3 }}
            onClick={() => navigate(card.path)}
            className="rounded-3xl border border-border/50 bg-card/70 p-5 text-left transition-all hover:border-primary/30 hover:shadow-[0_10px_30px_-12px_hsl(45_95%_55%/0.18)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                <card.icon className="h-5 w-5" />
              </div>
              <span className="text-2xl font-black tabular-nums">{card.value}</span>
            </div>
            <div className="mt-4 space-y-1.5">
              <h2 className="text-base font-semibold">{card.title}</h2>
              <p className="text-sm leading-6 text-muted-foreground">{card.description}</p>
            </div>
            <div className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary">
              {card.cta}
              <ArrowRight className="h-4 w-4" />
            </div>
          </motion.button>
        ))}
      </div>

      {profile?.can_taxi || profile?.can_private_hire || profile?.can_courier ? (
        <div className="rounded-3xl border border-border/50 bg-background p-5">
          <h2 className="text-lg font-semibold">Driver capabilities</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {profile?.can_taxi && <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">Taxi</span>}
            {profile?.can_private_hire && <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">Private hire</span>}
            {profile?.can_courier && <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">Courier</span>}
            {profile?.pet_approved && <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">Pet approved</span>}
            {profile?.vehicle_type && <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">{profile.vehicle_type}</span>}
          </div>
        </div>
      ) : (
        <div className="rounded-3xl border border-amber-500/30 bg-amber-500/5 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-500" />
            <div>
              <h2 className="text-lg font-semibold">Driver setup may be incomplete</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                This account does not appear to have any driver capabilities enabled yet. Check the admin user settings if dispatch looks empty.
              </p>
            </div>
          </div>
        </div>
      )}

      <DriverEarningsSummary />
    </div>
  );
};

export default DriverDashboard;
