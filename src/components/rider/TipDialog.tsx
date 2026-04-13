import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DollarSign, PartyPopper, Heart } from "lucide-react";
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

const CONFETTI_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "#f59e0b",
  "#10b981",
  "#8b5cf6",
  "#ec4899",
];

function ConfettiParticle({ delay, left, color }: { delay: number; left: number; color: string }) {
  return (
    <span
      className="absolute top-0 rounded-full pointer-events-none"
      style={{
        left: `${left}%`,
        width: 8,
        height: 8,
        backgroundColor: color,
        animation: `confetti-fall 1.2s ${delay}s ease-out forwards`,
        opacity: 0,
      }}
    />
  );
}

export default function TipDialog({ open, onOpenChange, rideId, driverName, onTipped }: TipDialogProps) {
  const [tipCents, setTipCents] = useState(0);
  const [customTip, setCustomTip] = useState("");
  const [showCustomTip, setShowCustomTip] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [sentAmount, setSentAmount] = useState(0);
  const { t } = useTranslation();

  const finalTip = showCustomTip && customTip ? Math.round(parseFloat(customTip) * 100) : tipCents;

  const playCelebrationSound = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.12);
        osc.stop(ctx.currentTime + i * 0.12 + 0.5);
      });
    } catch {
      // Audio not supported, skip silently
    }
  };

  const resetState = () => {
    setTipCents(0);
    setCustomTip("");
    setShowCustomTip(false);
    setShowCelebration(false);
    setSentAmount(0);
  };

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
      setSentAmount(finalTip);
      setShowCelebration(true);
      playCelebrationSound();
      setTimeout(() => {
        onOpenChange(false);
        resetState();
        onTipped?.();
      }, 2200);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenChange = (val: boolean) => {
    if (!val) resetState();
    onOpenChange(val);
  };

  return (
    <>
      <style>{`
        @keyframes confetti-fall {
          0% { opacity: 1; transform: translateY(0) rotate(0deg) scale(1); }
          100% { opacity: 0; transform: translateY(180px) rotate(720deg) scale(0.3); }
        }
        @keyframes celebration-pop {
          0% { transform: scale(0.3); opacity: 0; }
          50% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes heart-float {
          0% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-40px) scale(1.5); }
        }
      `}</style>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md overflow-hidden">
          {showCelebration ? (
            <div className="relative flex flex-col items-center justify-center py-8 min-h-[220px]">
              {/* Confetti */}
              {Array.from({ length: 18 }).map((_, i) => (
                <ConfettiParticle
                  key={i}
                  delay={Math.random() * 0.4}
                  left={Math.random() * 100}
                  color={CONFETTI_COLORS[i % CONFETTI_COLORS.length]}
                />
              ))}

              {/* Icon */}
              <div
                className="rounded-full bg-primary/10 p-4 mb-4"
                style={{ animation: "celebration-pop 0.5s ease-out forwards" }}
              >
                <PartyPopper className="h-10 w-10 text-primary" />
              </div>

              {/* Amount */}
              <p
                className="text-2xl font-bold text-foreground"
                style={{ animation: "celebration-pop 0.5s 0.15s ease-out both" }}
              >
                ${(sentAmount / 100).toFixed(2)}
              </p>

              {/* Message */}
              <p
                className="text-sm text-muted-foreground mt-1 flex items-center gap-1"
                style={{ animation: "celebration-pop 0.5s 0.3s ease-out both" }}
              >
                {t("tip.sentSuccess", "Tip sent!")}
                <Heart
                  className="h-4 w-4 text-destructive inline-block"
                  style={{ animation: "heart-float 1.2s 0.8s ease-out forwards" }}
                />
              </p>

              {driverName && (
                <p
                  className="text-xs text-muted-foreground mt-2"
                  style={{ animation: "celebration-pop 0.5s 0.45s ease-out both" }}
                >
                  {t("tip.driverThanks", { name: driverName, defaultValue: `${driverName} appreciates it!` })}
                </p>
              )}
            </div>
          ) : (
            <>
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
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}