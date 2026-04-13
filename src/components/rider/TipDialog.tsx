import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useTranslation } from "react-i18next";

interface TipDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rideId: string;
  driverName?: string;
  onTipped?: () => void;
}

const TIP_PRESETS = [200, 500, 1000];

export default function TipDialog({ open, onOpenChange, rideId, driverName, onTipped }: TipDialogProps) {
  const [tipCents, setTipCents] = useState(0);
  const [customTip, setCustomTip] = useState("");
  const [showCustomTip, setShowCustomTip] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { t } = useTranslation();

  const finalTip = showCustomTip && customTip ? Math.round(parseFloat(customTip) * 100) : tipCents;

  const handleSubmit = async () => {
    if (finalTip <= 0) {
      toast.error(t("tip.selectAmount", "Please select a tip amount"));
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("rides")
        .update({ tip_cents: finalTip } as any)
        .eq("id", rideId);
      if (error) throw error;
      toast.success(`$${(finalTip / 100).toFixed(2)} ${t("tip.sent", "tip sent!")}` );
      onOpenChange(false);
      setTipCents(0);
      setCustomTip("");
      setShowCustomTip(false);
      onTipped?.();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            {t("tip.addTip", "Add a Tip")}
          </DialogTitle>
          <DialogDescription>
            {driverName
              ? t("tip.thankDriver", { name: driverName, defaultValue: `Show appreciation for ${driverName}` })
              : t("tip.thankYourDriver", "Show appreciation for your driver")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex gap-2">
            {TIP_PRESETS.map((amount) => (
              <button
                key={amount}
                onClick={() => { setTipCents(amount); setShowCustomTip(false); }}
                className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-colors ${
                  tipCents === amount && !showCustomTip
                    ? "bg-primary/10 text-primary ring-1 ring-primary/30"
                    : "bg-secondary hover:bg-accent"
                }`}
              >
                ${(amount / 100).toFixed(0)}
              </button>
            ))}
            <button
              onClick={() => { setShowCustomTip(true); setTipCents(0); }}
              className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-colors ${
                showCustomTip
                  ? "bg-primary/10 text-primary ring-1 ring-primary/30"
                  : "bg-secondary hover:bg-accent"
              }`}
            >
              {t("tip.custom", "Custom")}
            </button>
          </div>

          {showCustomTip && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">$</span>
              <input
                type="number"
                min="0"
                step="0.50"
                value={customTip}
                onChange={(e) => setCustomTip(e.target.value)}
                placeholder="0.00"
                className="flex-1 h-10 rounded-lg bg-secondary border-0 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          )}

          <Button
            onClick={handleSubmit}
            disabled={submitting || finalTip <= 0}
            className="w-full"
          >
            {submitting
              ? t("tip.sending", "Sending...")
              : finalTip > 0
                ? `${t("tip.sendTip", "Send")} $${(finalTip / 100).toFixed(2)} ${t("tip.tipLabel", "tip")}`
                : t("tip.selectAmount", "Select an amount")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
