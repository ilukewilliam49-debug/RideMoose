import { useMemo } from "react";
import { format, parseISO, startOfDay } from "date-fns";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface RevenueChartProps {
  rides: any[];
}

const RevenueChart = ({ rides }: RevenueChartProps) => {
  const chartData = useMemo(() => {
    const buckets: Record<string, { date: string; revenue: number }> = {};

    rides.forEach((r: any) => {
      if (r.status !== "completed") return;
      const day = format(startOfDay(parseISO(r.created_at)), "yyyy-MM-dd");
      if (!buckets[day]) buckets[day] = { date: day, revenue: 0 };
      buckets[day].revenue += Number(r.final_price || r.estimated_price || 0);
    });

    return Object.values(buckets)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30);
  }, [rides]);

  if (chartData.length === 0) {
    return (
      <div className="rounded-xl border border-border/50 bg-card/70 p-6 text-center text-muted-foreground text-sm">
        No revenue data to chart.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card/70 p-4">
      <h3 className="text-sm font-semibold mb-4 text-foreground">Daily Revenue</h3>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={chartData} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => format(parseISO(v), "MMM d")}
            className="fill-muted-foreground"
          />
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => `$${v}`}
            className="fill-muted-foreground"
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelFormatter={(v) => format(parseISO(v as string), "MMM d, yyyy")}
            formatter={(value: number) => [`$${value.toFixed(2)}`, "Revenue"]}
          />
          <Line
            type="monotone"
            dataKey="revenue"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={{ r: 3, fill: "hsl(var(--primary))" }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default RevenueChart;
