import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, Banknote, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";

const DriverEarningsSummary = () => {
  const { profile } = useAuth();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["driver-earnings-summary", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;

      const { data: rides, error } = await supabase
        .from("rides")
        .select("driver_earnings_cents, commission_cents, service_fee_cents, stripe_fee_cents, final_fare_cents, status")
        .eq("driver_id", profile.id)
        .eq("status", "completed");

      if (error) throw error;

      const totalEarnings = (rides || []).reduce((sum, r) => sum + (r.driver_earnings_cents || 0), 0);
      const totalCommission = (rides || []).reduce((sum, r) => sum + (r.commission_cents || 0), 0);
      const totalGross = (rides || []).reduce((sum, r) => sum + (r.final_fare_cents || 0), 0);
      const tripCount = rides?.length || 0;

      return {
        totalEarnings,
        totalCommission,
        totalGross,
        tripCount,
        outstandingBalance: profile.driver_balance_cents || 0,
      };
    },
    enabled: !!profile?.id,
  });

  const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const items = [
    { icon: TrendingUp, label: "Gross Fares", value: stats ? fmt(stats.totalGross) : "—", color: "text-primary" },
    { icon: DollarSign, label: "Net Earnings", value: stats ? fmt(stats.totalEarnings) : "—", color: "text-green-500" },
    { icon: Banknote, label: "Commission Paid", value: stats ? fmt(stats.totalCommission) : "—", color: "text-muted-foreground" },
    { icon: AlertTriangle, label: "Balance Owed", value: stats ? fmt(stats.outstandingBalance) : "—", color: stats && stats.outstandingBalance > 0 ? "text-yellow-500" : "text-muted-foreground" },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-primary" />
          Earnings Summary
          {stats && <span className="text-xs font-normal text-muted-foreground ml-auto">{stats.tripCount} trips</span>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {items.map((item, i) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="space-y-1"
            >
              <div className="flex items-center gap-1.5">
                <item.icon className={`h-3.5 w-3.5 ${item.color}`} />
                <span className="text-xs text-muted-foreground">{item.label}</span>
              </div>
              <p className={`text-xl font-bold font-mono ${item.color}`}>
                {isLoading ? "…" : item.value}
              </p>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default DriverEarningsSummary;
