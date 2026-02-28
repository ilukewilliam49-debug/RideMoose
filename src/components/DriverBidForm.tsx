import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { DollarSign, Send, Pencil, Trash2 } from "lucide-react";

interface ExistingBid {
  id: string;
  offer_amount_cents: number;
  status: string;
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

  const handleSubmit = async () => {
    const cents = Math.round(parseFloat(amount) * 100);
    if (isNaN(cents) || cents < 3000) {
      toast.error("Minimum bid is $30.00");
      return;
    }
    setSubmitting(true);
    try {
      if (existingBid && editing) {
        // Update existing bid
        const { error } = await supabase
          .from("delivery_bids")
          .update({ offer_amount_cents: cents } as any)
          .eq("id", existingBid.id);
        if (error) throw error;
        toast.success("Bid updated!");
        setEditing(false);
      } else {
        // New bid
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
      </div>
    );
  }

  return (
    <div className="space-y-2">
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
        <Button size="sm" disabled={submitting} onClick={handleSubmit} className="gap-1">
          <Send className="h-3.5 w-3.5" /> {submitting ? "..." : editing ? "Update" : "Bid"}
        </Button>
        {editing && (
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        )}
      </div>
      <p className="text-[10px] text-muted-foreground">Min $30.00 · Commission: 8%</p>
    </div>
  );
};

export default DriverBidForm;
