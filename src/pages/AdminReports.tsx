import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Download, TrendingUp, DollarSign, CheckCircle, BarChart3, Clock } from "lucide-react";
import AdminBreadcrumb from "@/components/admin/AdminBreadcrumb";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import ErrorRetry from "@/components/driver/ErrorRetry";
import { format, subDays, startOfMonth } from "date-fns";
import { Badge } from "@/components/ui/badge";
import RideTrendsChart from "@/components/admin/RideTrendsChart";
import RevenueChart from "@/components/admin/RevenueChart";
import ServiceBreakdownChart from "@/components/admin/ServiceBreakdownChart";

const PAGE_SIZE = 25;

const AdminReports = () => {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [scheduledFilter, setScheduledFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [datePreset, setDatePreset] = useState("all");
  const [page, setPage] = useState(0);

  const applyDatePreset = (preset: string) => {
    setDatePreset(preset);
    const today = format(new Date(), "yyyy-MM-dd");
    if (preset === "7d") {
      setDateFrom(format(subDays(new Date(), 7), "yyyy-MM-dd"));
      setDateTo(today);
    } else if (preset === "30d") {
      setDateFrom(format(subDays(new Date(), 30), "yyyy-MM-dd"));
      setDateTo(today);
    } else if (preset === "month") {
      setDateFrom(format(startOfMonth(new Date()), "yyyy-MM-dd"));
      setDateTo(today);
    } else if (preset === "90d") {
      setDateFrom(format(subDays(new Date(), 90), "yyyy-MM-dd"));
      setDateTo(today);
    } else if (preset === "year") {
      setDateFrom(format(subDays(new Date(), 365), "yyyy-MM-dd"));
      setDateTo(today);
    } else {
      setDateFrom("");
      setDateTo("");
    }
    setPage(0);
  };

  const { data: rides, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-all-rides"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rides")
        .select("*, rider:rider_id(full_name), driver:driver_id(full_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    let result = rides || [];
    if (statusFilter !== "all") result = result.filter((r: any) => r.status === statusFilter);
    if (serviceFilter !== "all") result = result.filter((r: any) => r.service_type === serviceFilter);
    if (dateFrom) result = result.filter((r: any) => r.created_at >= dateFrom);
    if (dateTo) result = result.filter((r: any) => r.created_at.slice(0, 10) <= dateTo);
    if (scheduledFilter === "scheduled") result = result.filter((r: any) => r.scheduled_at);
    if (scheduledFilter === "now") result = result.filter((r: any) => !r.scheduled_at);
    return result;
  }, [rides, statusFilter, serviceFilter, dateFrom, dateTo, scheduledFilter]);

  const stats = useMemo(() => {
    const completed = filtered.filter((r: any) => r.status === "completed");
    const totalRevenue = completed.reduce((s: number, r: any) => s + Number(r.final_price || r.estimated_price || 0), 0);
    const avgFare = completed.length ? totalRevenue / completed.length : 0;
    const completionRate = filtered.length ? (completed.length / filtered.length) * 100 : 0;
    const scheduledCount = filtered.filter((r: any) => r.scheduled_at).length;
    return { totalRevenue, avgFare, completionRate, completedCount: completed.length, scheduledCount };
  }, [filtered]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const exportCSV = () => {
    if (!filtered.length) { toast.error("No data to export"); return; }
    const headers = ["ID", "Rider", "Driver", "Service", "Status", "Pickup", "Dropoff", "Est. Price", "Final Price", "Scheduled At", "Created"];
    const rows = filtered.map((r: any) => [
      r.id, r.rider?.full_name || "", r.driver?.full_name || "", r.service_type, r.status,
      r.pickup_address, r.dropoff_address, r.estimated_price || "", r.final_price || "",
      r.scheduled_at ? format(new Date(r.scheduled_at), "yyyy-MM-dd HH:mm") : "", r.created_at,
    ]);
    const csv = [headers, ...rows].map((row) => row.map((v: any) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pickyou-report-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported!");
  };

  const statusColor: Record<string, string> = {
    requested: "text-yellow-400",
    dispatched: "text-blue-400",
    accepted: "text-cyan-400",
    in_progress: "text-primary",
    completed: "text-green-400",
    cancelled: "text-muted-foreground",
  };

  const statCards = [
    { label: "Total Revenue", value: `$${stats.totalRevenue.toFixed(2)}`, icon: DollarSign },
    { label: "Avg Fare", value: `$${stats.avgFare.toFixed(2)}`, icon: TrendingUp },
    { label: "Completed", value: stats.completedCount, icon: CheckCircle },
    { label: "Completion Rate", value: `${stats.completionRate.toFixed(1)}%`, icon: BarChart3 },
    { label: "Scheduled", value: stats.scheduledCount, icon: Clock },
  ];

  return (
    <div className="space-y-6 pt-4">
      <AdminBreadcrumb />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Trip Reports</h1>
        <Button size="sm" variant="outline" onClick={exportCSV}>
          <Download className="h-4 w-4 mr-2" /> Export CSV
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)
          : statCards.map((s) => (
              <div key={s.label} className="rounded-xl border border-border/50 bg-card/70 p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <s.icon className="h-4 w-4" />
                  <span className="text-xs">{s.label}</span>
                </div>
                <p className="text-xl font-bold tabular-nums">{s.value}</p>
              </div>
            ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {["requested", "dispatched", "accepted", "in_progress", "completed", "cancelled"].map((s) => (
              <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={serviceFilter} onValueChange={(v) => { setServiceFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Service" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All services</SelectItem>
            {["taxi", "shuttle", "private_hire", "courier", "large_delivery", "retail_delivery", "personal_shopper", "food_delivery", "pet_transport"].map((s) => (
              <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={scheduledFilter} onValueChange={(v) => { setScheduledFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Booking" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All bookings</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="now">Immediate</SelectItem>
          </SelectContent>
        </Select>
        <Select value={datePreset} onValueChange={applyDatePreset}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Date range" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All time</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="month">This month</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
            <SelectItem value="year">Last year</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setDatePreset("custom"); setPage(0); }} className="w-[150px]" placeholder="From" />
        <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setDatePreset("custom"); setPage(0); }} className="w-[150px]" placeholder="To" />
      </div>

      {!isLoading && !isError && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <RideTrendsChart rides={filtered} />
            <RevenueChart rides={filtered} />
          </div>
          <ServiceBreakdownChart rides={filtered} />
        </>
      )}

      {isError ? (
        <ErrorRetry message="Failed to load ride data" onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded" />)}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-3 px-2">Rider</th>
                  <th className="py-3 px-2">Driver</th>
                  <th className="py-3 px-2">Service</th>
                  <th className="py-3 px-2">Route</th>
                   <th className="py-3 px-2">Status</th>
                   <th className="py-3 px-2">Scheduled</th>
                   <th className="py-3 px-2 text-right">Price</th>
                   <th className="py-3 px-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 && (
                  <tr>
                     <td colSpan={8} className="py-8 text-center text-muted-foreground">No trip data found.</td>
                   </tr>
                 )}
                 {paginated.map((ride: any) => (
                   <motion.tr key={ride.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border-b border-border/50 hover:bg-accent/50 transition-colors">
                     <td className="py-3 px-2">{ride.rider?.full_name || "—"}</td>
                     <td className="py-3 px-2">{ride.driver?.full_name || "—"}</td>
                     <td className="py-3 px-2 capitalize text-xs">{ride.service_type.replace("_", " ")}</td>
                     <td className="py-3 px-2 max-w-[200px] truncate">{ride.pickup_address} → {ride.dropoff_address}</td>
                     <td className="py-3 px-2">
                       <span className={`font-mono text-xs uppercase ${statusColor[ride.status] || ""}`}>
                         {ride.status.replace("_", " ")}
                       </span>
                     </td>
                     <td className="py-3 px-2">
                       {ride.scheduled_at ? (
                         <Badge variant="outline" className="gap-1 text-xs font-normal">
                           <Clock className="h-3 w-3" />
                           {format(new Date(ride.scheduled_at), "MMM d, HH:mm")}
                         </Badge>
                       ) : (
                         <span className="text-muted-foreground text-xs">Now</span>
                       )}
                     </td>
                     <td className="py-3 px-2 text-right font-mono">${Number(ride.final_price || ride.estimated_price || 0).toFixed(2)}</td>
                     <td className="py-3 px-2 text-muted-foreground">{new Date(ride.created_at).toLocaleDateString()}</td>
                   </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{filtered.length} ride{filtered.length !== 1 ? "s" : ""}</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
              <span>Page {page + 1} of {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminReports;
