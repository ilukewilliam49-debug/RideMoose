import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Star, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { z } from "zod";
import { useTranslation } from "react-i18next";

const ratingSchema = z.object({
  rating: z.number().min(1, "Please select a rating").max(5),
  comment: z.string().max(500, "Comment must be under 500 characters").optional(),
});

interface RideRatingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rideId: string;
  driverId: string;
  ratedBy: string;
  driverName?: string;
  onRated?: () => void;
}

const TIP_PRESETS = [0, 200, 500, 1000];

const RideRatingDialog = ({
  open,
  onOpenChange,
  rideId,
  driverId,
  ratedBy,
  driverName,
  onRated,
}: RideRatingDialogProps) => {
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [tipCents, setTipCents] = useState(0);
  const [customTip, setCustomTip] = useState("");
  const [showCustomTip, setShowCustomTip] = useState(false);
  const { t } = useTranslation();

  const handleSubmit = async () => {
    const result = ratingSchema.safeParse({ rating, comment: comment || undefined });
    if (!result.success) {
      toast.error(result.error.errors[0].message);
      return;
    }

    setSubmitting(true);
    try {
      // Submit rating
      const { error } = await supabase.from("ride_ratings").insert({
        ride_id: rideId,
        rated_by: ratedBy,
        rated_user: driverId,
        rating,
        comment: comment.trim() || null,
      });
      if (error) {
        if (error.code === "23505") {
          toast.info(t("rating.alreadyRated"));
        } else {
          throw error;
        }
      } else {
        toast.success(t("rating.thanksForRating"));
      }

      // Submit tip if any
      const finalTip = showCustomTip && customTip ? Math.round(parseFloat(customTip) * 100) : tipCents;
      if (finalTip > 0) {
        await supabase
          .from("rides")
          .update({ tip_cents: finalTip } as any)
          .eq("id", rideId);
        toast.success(`$${(finalTip / 100).toFixed(2)} tip sent!`);
      }

      onOpenChange(false);
      setRating(0);
      setComment("");
      setTipCents(0);
      setCustomTip("");
      setShowCustomTip(false);
      onRated?.();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const displayRating = hoveredStar || rating;
  const ratingLabels = ["", t("rating.poor"), t("rating.fair"), t("rating.good"), t("rating.great"), t("rating.excellent")];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("rating.rateYourRide")}</DialogTitle>
          <DialogDescription>
            {driverName
              ? t("rating.howWasTripWith", { name: driverName })
              : t("rating.howWasTrip")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Stars */}
          <div className="flex flex-col items-center gap-2">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onMouseEnter={() => setHoveredStar(star)}
                  onMouseLeave={() => setHoveredStar(0)}
                  onClick={() => setRating(star)}
                  className="p-1 transition-transform hover:scale-110"
                >
                  <Star
                    className={`h-8 w-8 transition-colors ${
                      star <= displayRating
                        ? "fill-primary text-primary"
                        : "text-muted-foreground/30"
                    }`}
                  />
                </button>
              ))}
            </div>
            {displayRating > 0 && (
              <span className="text-sm font-medium text-muted-foreground">
                {ratingLabels[displayRating]}
              </span>
            )}
          </div>

          {/* Tip section */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Add a tip for {driverName || "your driver"}</span>
            </div>
            <div className="flex gap-2">
              {TIP_PRESETS.map((amount) => (
                <button
                  key={amount}
                  onClick={() => { setTipCents(amount); setShowCustomTip(false); }}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${
                    tipCents === amount && !showCustomTip
                      ? "bg-primary/10 text-primary ring-1 ring-primary/30"
                      : "bg-secondary hover:bg-accent"
                  }`}
                >
                  {amount === 0 ? "No tip" : `$${(amount / 100).toFixed(0)}`}
                </button>
              ))}
              <button
                onClick={() => { setShowCustomTip(true); setTipCents(0); }}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${
                  showCustomTip
                    ? "bg-primary/10 text-primary ring-1 ring-primary/30"
                    : "bg-secondary hover:bg-accent"
                }`}
              >
                Custom
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
                  className="flex-1 h-9 rounded-lg bg-secondary border-0 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            )}
          </div>

          {/* Comment */}
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">
              {t("rating.commentOptional")}
            </label>
            <Textarea
              placeholder={t("rating.commentPlaceholder")}
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, 500))}
              rows={3}
              className="bg-secondary resize-none"
            />
            <p className="text-xs text-muted-foreground text-right">
              {comment.length}/500
            </p>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={submitting || rating === 0}
            className="w-full"
          >
            {submitting ? t("rating.submitting") : t("rating.submitRating")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RideRatingDialog;
