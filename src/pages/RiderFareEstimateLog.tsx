import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FareEstimateAuditTable, type FareEstimateAuditRow } from "@/components/FareEstimateAuditTable";

export default function RiderFareEstimateLog() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["rider-fare-estimate-log", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [] as FareEstimateAuditRow[];
      const { data, error } = await supabase
        .from("fare_estimate_audit_log" as any)
        .select("*")
        .eq("rider_profile_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as FareEstimateAuditRow[];
    },
    enabled: !!profile?.id,
  });

  const blockedCount = data?.filter((r) => r.event_type === "submit_blocked_stale").length ?? 0;

  return (
    <div className="space-y-6 p-4 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Receipt className="h-6 w-6 text-primary" />
        <h1 className="text-xl font-bold">Fare estimate history</h1>
        {data && <Badge variant="outline">{data.length} entries</Badge>}
        {blockedCount > 0 && (
          <Badge variant="destructive">{blockedCount} blocked submission(s)</Badge>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        Every time your trip details change, we recalculate the fare and record
        a new entry here. If a request was ever blocked because the price was
        still updating, you'll see it tagged "Submit blocked (stale)".
      </p>

      <FareEstimateAuditTable rows={data} isLoading={isLoading} />
    </div>
  );
}
