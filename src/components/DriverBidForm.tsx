import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { DollarSign, Send, Pencil, Trash2, Timer, TrendingDown, Users } from "lucide-react";

interface ExistingBid {
  id: string;
  offer_amount_cents: number;
  status: string;
}

interface BidStats {
  lowest_bid_cents: number | null;
  bid_count: number;
  bidding_ends_at: string | null;
}

interface DriverBidFormProps {
  rideId: string;
  driverId: string;
  estimatedPrice: number | null;
  existingBid?: ExistingBid | null;
  onBidChanged?: () => void;
}

const DriverBidForm = ({ rideId, driverId, estimatedPrice, existingBid, onBidChanged }: DriverBidFormProps) => {
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(() => {
    if (existingBid) return (existingBid.offer_amount_cents / 100).toFixed(2);
    if (estimatedPrice && estimatedPrice >= 30) return estimatedPrice.toFixed(2);
    return "30.00";
  });
  const [submitting, setSubmitting] = useState(false);
  const [stats, setStats] = useState<BidStats | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  // Fetch bid stats (lowest bid, count, deadline)
  useEffect(() => {
    const fetchStats = async () => {
      // Get bid count and lowest from all bids (driver can see aggregates)
      const { data: bids } = await supabase
        .from("delivery_bids")
        .select("offer_amount_cents")
        .eq("ride_id", rideId)
        .eq("status", "pending");

      const { data: ride } = await supabase
        .from("rides")
        .select("bidding_ends_at")
        .eq("id", rideId)
        .single();

      const lowestBid = bids?.length
        ? Math.min(...bids.map((b: any) => b.offer_amount_cents))
        : null;

      setStats({
        lowest_bid_cents: lowestBid,
        bid_count: bids?.length || 0,
        bidding_ends_at: (ride as any)?.bidding_ends_at || null,
      });
    };
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, [rideId]);

  // Countdown timer
  useEffect(() => {
    if (!stats?.bidding_ends_at) { setTimeLeft(null); return; }
    const update = () => {
      const remaining = Math.max(0, Math.floor((new Date(stats.bidding_ends_at!).getTime() - Date.now()) / 1000));
      setTimeLeft(remaining);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [stats?.bidding_ends_at]);

  const biddingClosed = timeLeft !== null && timeLeft <= 0;

  const handleSubmit = async () => {
    const cents = Math.round(parseFloat(amount) * 100);
    if (isNaN(cents) || cents < 3000) {
      toast.error("Minimum bid is $30.00");
      return;
    }
    if (biddingClosed) {
      toast.error("Bidding window has closed");
      return;
    }
    // Client-side undercut validation
    if (stats?.lowest_bid_cents !== null && stats?.lowest_bid_cents !== undefined) {
      const ownBidCents = existingBid?.offer_amount_cents;
      const effectiveLowest = ownBidCents === stats.lowest_bid_cents
        ? null // if driver's own bid is the lowest, no undercut needed
        : stats.lowest_bid_cents;
      if (effectiveLowest !== null && cents > effectiveLowest - 100) {
        toast.error(`Bid must be at least $1.00 lower than current lowest ($${(effectiveLowest / 100).toFixed(2)})`);
        return;
      }
    }
    setSubmitting(true);
    try {
      if (existingBid && editing) {
        const { error } = await supabase
          .from("delivery_bids")
          .update({ offer_amount_cents: cents } as any)
          .eq("id", existingBid.id);
        if (error) throw error;
        toast.success("Bid updated!");
        setEditing(false);
      } else {
        const { error } = await supabase.from("delivery_bids").insert({
          ride_id: rideId,
          driver_id: driverId,
          offer_amount_cents: cents,
        } as any);
        if (error) throw error;
        toast.success("Bid submitted!");
      }
      onBidChanged?.();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdraw = async () => {
    if (!existingBid) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("delivery_bids")
        .delete()
        .eq("id", existingBid.id);
      if (error) throw error;
      toast.success("Bid withdrawn.");
      onBidChanged?.();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  // Bid stats display
  const StatsBar = () => (
    <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
      {stats && stats.bid_count > 0 && (
        <>
          <span className="flex items-center gap-1">
            <TrendingDown className="h-3 w-3" />
            Lowest: ${((stats.lowest_bid_cents ?? 0) / 100).toFixed(2)}
          </span>
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {stats.bid_count} bid{stats.bid_count !== 1 ? "s" : ""}
          </span>
        </>
      )}
      {timeLeft !== null && (
        <span className={`flex items-center gap-1 font-mono ${biddingClosed ? "text-destructive" : timeLeft < 60 ? "text-yellow-500" : ""}`}>
          <Timer className="h-3 w-3" />
          {biddingClosed ? "Closed" : formatTime(timeLeft)}
        </span>
      )}
    </div>
  );

  // Show existing bid with edit/withdraw actions
  if (existingBid && !editing) {
    if (existingBid.status === "accepted") {
      return <p className="text-xs text-primary font-medium">✓ Bid accepted!</p>;
    }
    if (existingBid.status === "rejected") {
      return <p className="text-xs text-muted-foreground">✗ Bid rejected</p>;
    }
    return (
      <div className="space-y-1.5">
        <p className="text-xs font-mono font-medium">
          Bid: ${(existingBid.offer_amount_cents / 100).toFixed(2)}
        </p>
        <StatsBar />
        {!biddingClosed && (
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="gap-1 h-7 text-xs"
              disabled={submitting}
              onClick={() => { setEditing(true); setAmount((existingBid.offer_amount_cents / 100).toFixed(2)); }}
            >
              <Pencil className="h-3 w-3" /> Edit
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="gap-1 h-7 text-xs text-destructive hover:text-destructive"
              disabled={submitting}
              onClick={handleWithdraw}
            >
              <Trash2 className="h-3 w-3" /> Withdraw
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (biddingClosed && !existingBid) {
    return (
      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <Timer className="h-3 w-3" /> Bidding closed
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <StatsBar />
      <Label className="text-xs">{editing ? "Update Bid ($)" : "Your Bid Amount ($)"}</Label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            type="number"
            min="30"
            step="0.50"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="pl-8 font-mono"
            placeholder="30.00"
          />
        </div>
        <Button size="sm" disabled={submitting || biddingClosed} onClick={handleSubmit} className="gap-1">
          <Send className="h-3.5 w-3.5" /> {submitting ? "..." : editing ? "Update" : "Bid"}
        </Button>
        {editing && (
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        )}
      </div>
      <p className="text-[10px] text-muted-foreground">Min $30.00 · Must beat lowest by $1.00 · Commission: 8%</p>
    </div>
  );
};

export default DriverBidForm;
