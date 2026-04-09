import { useMemo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface ServiceBreakdownChartProps {
  rides: any[];
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent-foreground))",
  "hsl(142 71% 45%)",
  "hsl(38 92% 50%)",
  "hsl(0 84% 60%)",
  "hsl(262 83% 58%)",
  "hsl(199 89% 48%)",
  "hsl(326 80% 55%)",
  "hsl(168 76% 42%)",
];

const ServiceBreakdownChart = ({ rides }: ServiceBreakdownChartProps) => {
  const isMobile = useIsMobile();

  const chartData = useMemo(() => {
    const counts: Record<string, number> = {};
    rides.forEach((r: any) => {
      const label = (r.service_type as string).replace(/_/g, " ");
      counts[label] = (counts[label] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [rides]);

  if (chartData.length === 0) {
    return (
      <div className="rounded-xl border border-border/50 bg-card/70 p-6 text-center text-muted-foreground text-sm">
        No service data to chart.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card/70 p-4">
      <h3 className="text-sm font-semibold mb-4 text-foreground">Service Breakdown</h3>
      <ResponsiveContainer width="100%" height={isMobile ? 300 : 260}>
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="45%"
            outerRadius={isMobile ? 70 : 90}
            innerRadius={isMobile ? 35 : 45}
            paddingAngle={2}
            label={isMobile
              ? ({ percent }) => `${(percent * 100).toFixed(0)}%`
              : ({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`
            }
            labelLine={{ strokeWidth: 1 }}
            style={{ fontSize: isMobile ? 9 : 10 }}
          >
            {chartData.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value: number, name: string) => [`${value} rides`, name]}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ServiceBreakdownChart;
