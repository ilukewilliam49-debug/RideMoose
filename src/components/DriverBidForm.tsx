import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { DollarSign, Send } from "lucide-react";

interface DriverBidFormProps {
  rideId: string;
  driverId: string;
  estimatedPrice: number | null;
  existingBidId?: string;
  onBidPlaced?: () => void;
}

const DriverBidForm = ({ rideId, driverId, estimatedPrice, existingBidId, onBidPlaced }: DriverBidFormProps) => {
  const [amount, setAmount] = useState(() => {
    if (estimatedPrice && estimatedPrice >= 30) return estimatedPrice.toFixed(2);
    return "30.00";
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const cents = Math.round(parseFloat(amount) * 100);
    if (isNaN(cents) || cents < 3000) {
      toast.error("Minimum bid is $30.00");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("delivery_bids").insert({
        ride_id: rideId,
        driver_id: driverId,
        offer_amount_cents: cents,
      } as any);
      if (error) throw error;
      toast.success("Bid submitted!");
      onBidPlaced?.();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (existingBidId) {
    return (
      <p className="text-xs text-muted-foreground">✓ You've already placed a bid on this delivery.</p>
    );
  }

  return (
    <div className="space-y-2">
      <Label className="text-xs">Your Bid Amount ($)</Label>
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
        <Button size="sm" disabled={submitting} onClick={handleSubmit} className="gap-1">
          <Send className="h-3.5 w-3.5" /> {submitting ? "..." : "Bid"}
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground">Min $30.00 · Commission: 8%</p>
    </div>
  );
};

export default DriverBidForm;
