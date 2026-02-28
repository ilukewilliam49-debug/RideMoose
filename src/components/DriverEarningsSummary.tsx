import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DollarSign, TrendingUp, CreditCard, CalendarIcon } from "lucide-react";
import { motion } from "framer-motion";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, subDays } from "date-fns";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import type { DateRange } from "react-day-picker";

const DriverEarningsSummary = () => {
  const { profile } = useAuth();
  const { t } = useTranslation();
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [activePreset, setActivePreset] = useState("allTime");

  const presets = [
    { key: "thisWeek", label: t("earnings.thisWeek"), range: () => ({ from: startOfWeek(new Date(), { weekStartsOn: 1 }), to: new Date() }) },
    { key: "thisMonth", label: t("earnings.thisMonth"), range: () => ({ from: startOfMonth(new Date()), to: new Date() }) },
    { key: "last30Days", label: t("earnings.last30Days"), range: () => ({ from: subDays(new Date(), 30), to: new Date() }) },
    { key: "allTime", label: t("earnings.allTime"), range: () => ({ from: undefined as Date | undefined, to: undefined as Date | undefined }) },
  ];

  const fromDate = dateRange?.from;
  const toDate = dateRange?.to;

  const { data: stats, isLoading } = useQuery({
    queryKey: ["driver-earnings-summary", profile?.id, fromDate?.toISOString(), toDate?.toISOString()],
    queryFn: async () => {
      if (!profile?.id) return null;

      let query = supabase
        .from("rides")
        .select("driver_earnings_cents, commission_cents, service_fee_cents, stripe_fee_cents, final_fare_cents, status, completed_at")
        .eq("driver_id", profile.id)
        .eq("status", "completed");

      if (fromDate) {
        query = query.gte("completed_at", fromDate.toISOString());
      }
      if (toDate) {
        const endOfDay = new Date(toDate);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte("completed_at", endOfDay.toISOString());
      }

      const { data: rides, error } = await query;
      if (error) throw error;

      const totalEarnings = (rides || []).reduce((sum, r) => sum + (r.driver_earnings_cents || 0), 0);
      const totalStripeFees = (rides || []).reduce((sum, r) => sum + (r.stripe_fee_cents || 0), 0);
      const totalGross = (rides || []).reduce((sum, r) => sum + (r.final_fare_cents || 0), 0);
      const tripCount = rides?.length || 0;

      return { totalEarnings, totalStripeFees, totalGross, tripCount };
    },
    enabled: !!profile?.id,
  });

  const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const handlePreset = (preset: typeof presets[number]) => {
    setActivePreset(preset.key);
    const r = preset.range();
    setDateRange(r.from ? { from: r.from, to: r.to } : undefined);
  };

  const items = [
    { icon: TrendingUp, label: t("earnings.grossFares"), value: stats ? fmt(stats.totalGross) : "—", color: "text-primary" },
    { icon: CreditCard, label: t("earnings.cardProcessingFee"), value: stats ? fmt(stats.totalStripeFees) : "—", color: "text-muted-foreground" },
    { icon: DollarSign, label: t("earnings.netEarnings"), value: stats ? fmt(stats.totalEarnings) : "—", color: "text-green-500" },
  ];

  const activePresetLabel = presets.find((p) => p.key === activePreset)?.label || activePreset;
  const dateLabel = fromDate && toDate
    ? `${format(fromDate, "MMM d")} – ${format(toDate, "MMM d, yyyy")}`
    : fromDate
      ? `From ${format(fromDate, "MMM d, yyyy")}`
      : activePresetLabel;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            {t("earnings.title")}
            {stats && <span className="text-xs font-normal text-muted-foreground">({stats.tripCount} {t("earnings.trips")})</span>}
          </CardTitle>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("text-xs gap-1.5", !dateRange && "text-muted-foreground")}>
                <CalendarIcon className="h-3.5 w-3.5" />
                {dateLabel}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <div className="flex flex-col sm:flex-row">
                <div className="flex flex-col gap-1 p-3 border-b sm:border-b-0 sm:border-r border-border">
                  <p className="text-xs font-medium text-muted-foreground mb-1">{t("earnings.quickSelect")}</p>
                  {presets.map((preset) => (
                    <Button
                      key={preset.key}
                      variant={activePreset === preset.key ? "default" : "ghost"}
                      size="sm"
                      className="justify-start text-xs h-7"
                      onClick={() => handlePreset(preset)}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={(range) => {
                    setDateRange(range);
                    setActivePreset("custom");
                  }}
                  numberOfMonths={1}
                  disabled={(date) => date > new Date()}
                  className={cn("p-3 pointer-events-auto")}
                />
              </div>
            </PopoverContent>
          </Popover>
        </div>
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
