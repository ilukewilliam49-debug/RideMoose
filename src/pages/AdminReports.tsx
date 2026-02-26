import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Download, Car } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

const AdminReports = () => {
  const { data: rides } = useQuery({
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

  const exportCSV = () => {
    if (!rides?.length) {
      toast.error("No data to export");
      return;
    }

    const headers = ["ID", "Rider", "Driver", "Status", "Pickup", "Dropoff", "Est. Price", "Final Price", "Created"];
    const rows = rides.map((r: any) => [
      r.id,
      r.rider?.full_name || "",
      r.driver?.full_name || "",
      r.status,
      r.pickup_address,
      r.dropoff_address,
      r.estimated_price || "",
      r.final_price || "",
      r.created_at,
    ]);

    const csv = [headers, ...rows].map((row) => row.map((v: any) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `onlyknifers-report-${new Date().toISOString().split("T")[0]}.csv`;
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

  return (
    <div className="space-y-6 pt-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Trip Reports</h1>
        <Button size="sm" variant="outline" onClick={exportCSV}>
          <Download className="h-4 w-4 mr-2" /> Export CSV
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="py-3 px-2">Rider</th>
              <th className="py-3 px-2">Driver</th>
              <th className="py-3 px-2">Route</th>
              <th className="py-3 px-2">Status</th>
              <th className="py-3 px-2 text-right">Price</th>
              <th className="py-3 px-2">Date</th>
            </tr>
          </thead>
          <tbody>
            {rides?.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-muted-foreground">
                  No trip data yet.
                </td>
              </tr>
            )}
            {rides?.map((ride: any) => (
              <motion.tr
                key={ride.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="border-b border-border/50 hover:bg-accent/50 transition-colors"
              >
                <td className="py-3 px-2">{ride.rider?.full_name || "—"}</td>
                <td className="py-3 px-2">{ride.driver?.full_name || "—"}</td>
                <td className="py-3 px-2 max-w-[200px] truncate">
                  {ride.pickup_address} → {ride.dropoff_address}
                </td>
                <td className="py-3 px-2">
                  <span className={`font-mono text-xs uppercase ${statusColor[ride.status] || ""}`}>
                    {ride.status.replace("_", " ")}
                  </span>
                </td>
                <td className="py-3 px-2 text-right font-mono">
                  ${Number(ride.final_price || ride.estimated_price || 0).toFixed(2)}
                </td>
                <td className="py-3 px-2 text-muted-foreground">
                  {new Date(ride.created_at).toLocaleDateString()}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminReports;
