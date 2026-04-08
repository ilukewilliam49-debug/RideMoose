import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Clock, TrendingUp, DollarSign } from "lucide-react";
import { fmt } from "@/lib/driver-constants";

interface ShiftSummaryDialogProps {
  open: boolean;
  onClose: () => void;
  profileId: string | undefined;
  shiftStartedAt: string | null;
}

const ShiftSummaryDialog = ({ open, onClose, profileId, shiftStartedAt }: ShiftSummaryDialogProps) => {
  const { data: summary } = useQuery({
    queryKey: ["shift-summary", profileId, shiftStartedAt],
    queryFn: async () => {
      if (!profileId || !shiftStartedAt) return null;
      const [tripsRes, earningsRes] = await Promise.all([
        supabase
          .from("rides")
          .select("id", { count: "exact", head: true })
          .eq("driver_id", profileId)
          .eq("status", "completed")
          .gte("completed_at", shiftStartedAt),
        supabase
          .from("rides")
          .select("driver_earnings_cents")
          .eq("driver_id", profileId)
          .eq("status", "completed")
          .gte("completed_at", shiftStartedAt),
      ]);

      const earnings = (earningsRes.data || []).reduce(
        (sum: number, r: any) => sum + (r.driver_earnings_cents || 0),
        0
      );

      const durationMs = Date.now() - new Date(shiftStartedAt).getTime();
      const hours = Math.floor(durationMs / 3600000);
      const minutes = Math.floor((durationMs % 3600000) / 60000);

      return {
        trips: tripsRes.count || 0,
        earnings,
        duration: hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`,
      };
    },
    enabled: open && !!profileId && !!shiftStartedAt,
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg">Shift summary</DialogTitle>
          <DialogDescription>Here's how your shift went</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-3 py-4">
          <div className="text-center space-y-1">
            <Clock className="h-5 w-5 mx-auto text-primary" />
            <p className="text-xl font-bold tabular-nums">{summary?.duration || "—"}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Duration</p>
          </div>
          <div className="text-center space-y-1">
            <TrendingUp className="h-5 w-5 mx-auto text-primary" />
            <p className="text-xl font-bold tabular-nums">{summary?.trips ?? "—"}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Trips</p>
          </div>
          <div className="text-center space-y-1">
            <DollarSign className="h-5 w-5 mx-auto text-green-500" />
            <p className="text-xl font-bold tabular-nums text-green-500">
              {summary ? fmt(summary.earnings) : "—"}
            </p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Earned</p>
          </div>
        </div>
        <Button onClick={onClose} className="w-full h-12 rounded-xl">
          Done
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default ShiftSummaryDialog;
