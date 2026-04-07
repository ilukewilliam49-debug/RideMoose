import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Shield,
  FileCheck,
  Users,
  BarChart3,
  CalendarCheck,
  MessageSquare,
  ArrowRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const AdminDashboard = () => {
  const navigate = useNavigate();

  const { data: stats } = useQuery({
    queryKey: ["admin-dashboard-stats"],
    queryFn: async () => {
      const [
        verificationsRes,
        usersRes,
        ridesRes,
        supportRes,
        bookingsRes,
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
        supabase
          .from("bokun_bookings" as any)
          .select("id", { count: "exact", head: true }),
      ]);

      return {
        pendingVerifications: verificationsRes.count || 0,
        totalUsers: usersRes.count || 0,
        activeRides: ridesRes.count || 0,
        openSupport: supportRes.count || 0,
        syncedBookings: bookingsRes.count || 0,
      };
    },
  });

  const cards = [
    {
      title: "Driver verifications",
      description: "Review pending documents and approve or reject drivers.",
      value: stats?.pendingVerifications ?? 0,
      icon: FileCheck,
      path: "/admin/verifications",
      cta: "Open verifications",
    },
    {
      title: "User management",
      description: "Manage roles, driver capabilities, and account access.",
      value: stats?.totalUsers ?? 0,
      icon: Users,
      path: "/admin/users",
      cta: "Open users",
    },
    {
      title: "Open rides",
      description: "Monitor rides currently requested, dispatched, accepted, or in progress.",
      value: stats?.activeRides ?? 0,
      icon: BarChart3,
      path: "/admin/reports",
      cta: "Open reports",
    },
    {
      title: "Support inbox",
      description: "Reply to customer conversations and resolve open cases.",
      value: stats?.openSupport ?? 0,
      icon: MessageSquare,
      path: "/admin/support",
      cta: "Open support",
    },
    {
      title: "Bókun bookings",
      description: "Review synced tour bookings and trigger a manual sync when needed.",
      value: stats?.syncedBookings ?? 0,
      icon: CalendarCheck,
      path: "/admin/bookings",
      cta: "Open bookings",
    },
  ];

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
          <h1 className="text-3xl font-bold tracking-tight">RideMoose admin dashboard</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            This is the internal operations area for approvals, reporting, support, pricing,
            zones, and bookings — not the rider booking experience.
          </p>
        </div>
      </motion.div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card, index) => (
          <motion.button
            key={card.title}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06, duration: 0.3 }}
            onClick={() => navigate(card.path)}
            className="rounded-3xl border border-border/50 bg-card/70 p-6 text-left transition-all hover:border-primary/30 hover:shadow-[0_10px_30px_-12px_hsl(45_95%_55%/0.18)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                <card.icon className="h-6 w-6" />
              </div>
              <span className="text-3xl font-black tabular-nums">{card.value}</span>
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

      <div className="rounded-3xl border border-border/50 bg-secondary/20 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Quick admin actions</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Jump straight to the operational areas you’re most likely to need.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
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
