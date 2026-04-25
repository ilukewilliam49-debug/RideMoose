import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Receipt, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { FareEstimateAuditTable, type FareEstimateAuditRow } from "@/components/FareEstimateAuditTable";

const PAGE_SIZE = 25;

const EVENT_OPTIONS = [
  { value: "all", label: "All events" },
  { value: "estimate_changed", label: "Estimate changed" },
  { value: "submit_blocked_stale", label: "Submit blocked (stale)" },
];

export default function AdminFareEstimateLog() {
  const [page, setPage] = useState(0);
  const [eventFilter, setEventFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-fare-estimate-log", page, eventFilter, searchTerm],
    queryFn: async () => {
      let query = supabase
        .from("fare_estimate_audit_log" as any)
        .select("*, profiles!fare_estimate_audit_log_rider_profile_id_fkey(full_name)", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (eventFilter !== "all") {
        query = query.eq("event_type", eventFilter);
      }
      if (searchTerm) {
        query = query.or(
          `pickup_address.ilike.%${searchTerm}%,dropoff_address.ilike.%${searchTerm}%,service_type.ilike.%${searchTerm}%`
        );
      }

      const { data, count, error } = await query;
      if (error) throw error;
      return { rows: (data ?? []) as unknown as FareEstimateAuditRow[], total: count ?? 0 };
    },
  });

  const totalPages = Math.ceil((data?.total ?? 0) / PAGE_SIZE);
  const blockedCount = data?.rows.filter((r) => r.event_type === "submit_blocked_stale").length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 flex-wrap">
        <Receipt className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Fare Estimate Log</h1>
        {data && <Badge variant="outline" className="ml-2">{data.total} entries</Badge>}
        {blockedCount > 0 && (
          <Badge variant="destructive">{blockedCount} stale-block(s) on this page</Badge>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        Tracks every change to a rider's fare estimate fingerprint and every time
        a ride request was blocked because the estimate was stale.
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-56">
          <label className="text-xs text-muted-foreground mb-1 block">Event type</label>
          <Select value={eventFilter} onValueChange={(v) => { setEventFilter(v); setPage(0); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {EVENT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-72">
          <label className="text-xs text-muted-foreground mb-1 block">Search</label>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="address or service..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
              className="pl-8"
            />
          </div>
        </div>
      </div>

      <FareEstimateAuditTable rows={data?.rows} isLoading={isLoading} showRider />

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Page {page + 1} of {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
