import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Star, Truck, DollarSign, Clock, Check, X, Timer, TrendingDown, Users } from "lucide-react";
import { motion } from "framer-motion";

interface DeliveryBidsListProps {
  rideId: string;
}

interface BidWithDriver {
  id: string;
  ride_id: string;
  driver_id: string;
  offer_amount_cents: number;
  status: string;
  created_at: string;
  driver_name: string;
  vehicle_type: string | null;
  avg_rating: number | null;
}

const DeliveryBidsList = ({ rideId }: DeliveryBidsListProps) => {
  const queryClient = useQueryClient();
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  // Fetch bidding_ends_at
  const { data: biddingEndsAt } = useQuery({
    queryKey: ["bidding-ends-at", rideId],
    queryFn: async () => {
      const { data } = await supabase
        .from("rides")
        .select("bidding_ends_at")
        .eq("id", rideId)
        .single();
      return (data as any)?.bidding_ends_at as string | null;
    },
  });

  // Countdown timer
  useEffect(() => {
    if (!biddingEndsAt) { setTimeLeft(null); return; }
    const update = () => {
      const remaining = Math.max(0, Math.floor((new Date(biddingEndsAt).getTime() - Date.now()) / 1000));
      setTimeLeft(remaining);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [biddingEndsAt]);

  const biddingClosed = timeLeft !== null && timeLeft <= 0;
  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const { data: bids, isLoading } = useQuery({
    queryKey: ["delivery-bids", rideId],
    queryFn: async () => {
      const { data: bidsData, error } = await supabase
        .from("delivery_bids")
        .select("*")
        .eq("ride_id", rideId)
        .order("offer_amount_cents", { ascending: true });
      if (error) throw error;
      if (!bidsData?.length) return [];

      const driverIds = bidsData.map((b: any) => b.driver_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, vehicle_type")
        .in("id", driverIds);

      const { data: ratings } = await supabase
        .from("ride_ratings")
        .select("rated_user, rating")
        .in("rated_user", driverIds);

      const ratingMap: Record<string, { sum: number; count: number }> = {};
      ratings?.forEach((r: any) => {
        if (!ratingMap[r.rated_user]) ratingMap[r.rated_user] = { sum: 0, count: 0 };
        ratingMap[r.rated_user].sum += r.rating;
        ratingMap[r.rated_user].count += 1;
      });

      const profileMap = new Map(profiles?.map((p: any) => [p.id, p]));

      return bidsData.map((b: any): BidWithDriver => {
        const prof = profileMap.get(b.driver_id);
        const rat = ratingMap[b.driver_id];
        return {
          ...b,
          driver_name: prof?.full_name || "Unknown",
          vehicle_type: prof?.vehicle_type || null,
          avg_rating: rat ? Math.round((rat.sum / rat.count) * 10) / 10 : null,
        };
      });
    },
    refetchInterval: 5000,
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`bids-${rideId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "delivery_bids", filter: `ride_id=eq.${rideId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["delivery-bids", rideId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [rideId, queryClient]);

  const acceptBid = async (bidId: string, driverId: string, offerCents: number) => {
    try {
      // Accept this bid
      const { error: acceptErr } = await supabase
        .from("delivery_bids")
        .update({ status: "accepted" })
        .eq("id", bidId);
      if (acceptErr) throw acceptErr;

      // Reject other pending bids
      await supabase
        .from("delivery_bids")
        .update({ status: "rejected" })
        .eq("ride_id", rideId)
        .neq("id", bidId)
        .eq("status", "pending");

      // Assign driver to ride with commission
      const commissionCents = Math.round(offerCents * 0.08);
      const { error: rideErr } = await supabase
        .from("rides")
        .update({
          driver_id: driverId,
          status: "accepted",
          estimated_price: offerCents / 100,
          final_fare_cents: offerCents,
          commission_cents: commissionCents,
          driver_earnings_cents: offerCents - commissionCents,
        })
        .eq("id", rideId);
      if (rideErr) throw rideErr;

      toast.success("Bid accepted! Driver assigned.");
      queryClient.invalidateQueries({ queryKey: ["rider-active-ride"] });
      queryClient.invalidateQueries({ queryKey: ["delivery-bids", rideId] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (isLoading) return <p className="text-xs text-muted-foreground">Loading bids...</p>;

  const pendingBids = bids?.filter((b) => b.status === "pending") || [];
  const acceptedBid = bids?.find((b) => b.status === "accepted");

  if (acceptedBid) {
    return (
      <div className="p-3 rounded-lg border border-green-500/30 bg-green-500/5">
        <p className="text-xs text-green-500 font-medium flex items-center gap-1">
          <Check className="h-3.5 w-3.5" /> Bid accepted — {acceptedBid.driver_name}
        </p>
        <p className="text-xs text-muted-foreground font-mono mt-1">
          ${(acceptedBid.offer_amount_cents / 100).toFixed(2)}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Stats bar */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Users className="h-3.5 w-3.5" />
          {pendingBids.length} bid{pendingBids.length !== 1 ? "s" : ""}
        </span>
        {pendingBids.length > 0 && (
          <span className="flex items-center gap-1">
            <TrendingDown className="h-3.5 w-3.5" />
            Lowest: ${(pendingBids[0].offer_amount_cents / 100).toFixed(2)}
          </span>
        )}
        {timeLeft !== null && (
          <span className={`flex items-center gap-1 font-mono ${biddingClosed ? "text-primary font-medium" : timeLeft < 60 ? "text-yellow-500" : ""}`}>
            <Timer className="h-3.5 w-3.5" />
            {biddingClosed ? "Select a bid" : formatTime(timeLeft)}
          </span>
        )}
      </div>

      {pendingBids.length === 0 ? (
        <div className="p-3 rounded-lg border border-dashed border-muted-foreground/30">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" /> Waiting for driver bids...
          </p>
        </div>
      ) : (
        <>
          {!biddingClosed && (
            <p className="text-[10px] text-muted-foreground">
              You can select a winning bid after the 5-minute bidding window closes.
            </p>
          )}
          {pendingBids.map((bid) => (
            <motion.div
              key={bid.id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-surface rounded-lg p-3 space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">{bid.driver_name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {bid.vehicle_type && (
                      <span className="flex items-center gap-1">
                        <Truck className="h-3 w-3" /> {bid.vehicle_type}
                      </span>
                    )}
                    {bid.avg_rating !== null && (
                      <span className="flex items-center gap-0.5">
                        <Star className="h-3 w-3 text-yellow-500" /> {bid.avg_rating}
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-lg font-bold font-mono text-primary">
                  ${(bid.offer_amount_cents / 100).toFixed(2)}
                </p>
              </div>
              {biddingClosed && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 gap-1"
                    onClick={() => acceptBid(bid.id, bid.driver_id, bid.offer_amount_cents)}
                  >
                    <Check className="h-3.5 w-3.5" /> Select Winner
                  </Button>
                </div>
              )}
            </motion.div>
          ))}
        </>
      )}
    </div>
  );
};

export default DeliveryBidsList;
