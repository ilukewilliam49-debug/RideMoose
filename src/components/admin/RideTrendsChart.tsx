import { useMemo } from "react";
import { format, parseISO, startOfDay } from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface RideTrendsChartProps {
  rides: any[];
}

const RideTrendsChart = ({ rides }: RideTrendsChartProps) => {
  const chartData = useMemo(() => {
    const buckets: Record<string, { date: string; completed: number; cancelled: number; other: number }> = {};

    rides.forEach((r: any) => {
      const day = format(startOfDay(parseISO(r.created_at)), "yyyy-MM-dd");
      if (!buckets[day]) buckets[day] = { date: day, completed: 0, cancelled: 0, other: 0 };
      if (r.status === "completed") buckets[day].completed++;
      else if (r.status === "cancelled") buckets[day].cancelled++;
      else buckets[day].other++;
    });

    return Object.values(buckets)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30); // last 30 days with data
  }, [rides]);

  if (chartData.length === 0) {
    return (
      <div className="rounded-xl border border-border/50 bg-card/70 p-6 text-center text-muted-foreground text-sm">
        No ride data to chart.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card/70 p-4">
      <h3 className="text-sm font-semibold mb-4 text-foreground">Daily Ride Trends</h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => format(parseISO(v), "MMM d")}
            className="fill-muted-foreground"
          />
          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} className="fill-muted-foreground" />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelFormatter={(v) => format(parseISO(v as string), "MMM d, yyyy")}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="completed" name="Completed" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} stackId="a" />
          <Bar dataKey="cancelled" name="Cancelled" fill="hsl(var(--muted-foreground))" radius={[3, 3, 0, 0]} stackId="a" />
          <Bar dataKey="other" name="In Progress" fill="hsl(var(--accent-foreground) / 0.4)" radius={[3, 3, 0, 0]} stackId="a" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default RideTrendsChart;
