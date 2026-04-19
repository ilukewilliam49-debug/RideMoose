import { useState } from "react";
import { motion } from "framer-motion";
import { X, Clock, Route, DollarSign, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { serviceLabels, fmt } from "@/lib/driver-constants";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const RIDER_FEEDBACK_TAGS = [
  { label: "Polite", emoji: "😊" },
  { label: "Ready on time", emoji: "⏰" },
  { label: "Good directions", emoji: "📍" },
  { label: "Kept car clean", emoji: "🧼" },
  { label: "Late to pickup", emoji: "⏳" },
  { label: "Rude", emoji: "😤" },
  { label: "Wrong pin", emoji: "📌" },
  { label: "No-show risk", emoji: "👻" },
];

interface TripSummaryCardProps {
  ride: {
    id: string;
    service_type: string;
    pickup_address: string;
    dropoff_address: string;
    distance_km?: number | null;
    duration_min?: number;
    final_price?: number | null;
    final_fare_cents?: number | null;
    driver_earnings_cents?: number;
    commission_cents?: number;
    tip_cents?: number;
    tax_cents?: number;
    payment_option?: string;
    completed_at?: string | null;
    rider_id?: string;
  };
  driverProfileId?: string;
  onDismiss: () => void;
}

export default function TripSummaryCard({ ride, driverProfileId, onDismiss }: TripSummaryCardProps) {
  const fareCents = ride.final_fare_cents ?? Math.round((ride.final_price ?? 0) * 100);
  const tipCents = (ride as any).tip_cents ?? 0;
  const taxCents = ride.tax_cents ?? 0;
  const earnings = (ride.driver_earnings_cents ?? 0) + tipCents;
  const isPrivateHire = ride.service_type === "private_hire";
  const surchargeCents = isPrivateHire ? 299 : 0;

  // Rating state
  const [riderRating, setRiderRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [riderComment, setRiderComment] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const displayRating = hoveredStar || riderRating;
  const ratingLabels = ["", "Poor", "Fair", "Good", "Great", "Excellent"];

  const visibleTags = riderRating === 0
    ? RIDER_FEEDBACK_TAGS
    : riderRating >= 4
      ? RIDER_FEEDBACK_TAGS.filter((t) => !["Late to pickup", "Rude", "Wrong pin", "No-show risk"].includes(t.label))
      : riderRating <= 2
        ? RIDER_FEEDBACK_TAGS.filter((t) => !["Polite", "Ready on time", "Good directions", "Kept car clean"].includes(t.label))
        : RIDER_FEEDBACK_TAGS;

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const submitRiderRating = async () => {
    if (!driverProfileId || !ride.rider_id || riderRating === 0) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("ride_ratings").insert({
        ride_id: ride.id,
        rated_by: driverProfileId,
        rated_user: ride.rider_id,
        rating: riderRating,
        comment: riderComment.trim() || null,
        feedback_tags: selectedTags.length > 0 ? selectedTags : [],
      } as any);
      if (error) {
        if (error.code === "23505") {
          toast.info("Already rated this rider");
        } else {
          throw error;
        }
      } else {
        toast.success("Rider rated — thanks!");
      }
      setRatingSubmitted(true);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="rounded-2xl bg-card ring-1 ring-border/50 overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-green-500/10">
            <Star className="h-4 w-4 text-green-500" />
          </div>
          <span className="text-sm font-bold">Trip Complete</span>
        </div>
        <button onClick={onDismiss} className="p-1 rounded-lg hover:bg-secondary transition-colors">
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      <div className="px-4 pb-3 space-y-3">
        {/* Route */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p className="truncate">📍 {ride.pickup_address}</p>
          <p className="truncate">🏁 {ride.dropoff_address}</p>
        </div>

        {/* Stats row */}
        <div className="flex gap-4">
          {ride.distance_km && (
            <div className="flex items-center gap-1.5 text-xs">
              <Route className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium">{Number(ride.distance_km).toFixed(1)} km</span>
            </div>
          )}
          {ride.duration_min ? (
            <div className="flex items-center gap-1.5 text-xs">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium">{Math.round(ride.duration_min)} min</span>
            </div>
          ) : null}
          <div className="flex items-center gap-1.5 text-xs">
            <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-medium">{serviceLabels[ride.service_type] || ride.service_type}</span>
          </div>
        </div>

        {/* Earnings breakdown */}
        <div className="rounded-xl bg-secondary/50 p-3 space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Fare</span>
            <span className="font-medium">{fmt(fareCents)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Commission</span>
            <span className="font-medium text-destructive">-{fmt(ride.commission_cents ?? 0)}</span>
          </div>
          {surchargeCents > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">PickYou Surcharge</span>
              <span className="font-medium">{fmt(surchargeCents)}</span>
            </div>
          )}
          {taxCents > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">GST (5%)</span>
              <span className="font-medium">{fmt(taxCents)}</span>
            </div>
          )}
          {tipCents > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Tip</span>
              <span className="font-medium text-green-500">+{fmt(tipCents)}</span>
            </div>
          )}
          <div className="h-px bg-border/50 my-1" />
          <div className="flex justify-between text-sm font-bold">
            <span>Your Earnings</span>
            <span className="text-green-500">{fmt(earnings)}</span>
          </div>
        </div>

        {/* Rate Rider Section */}
        {ride.rider_id && driverProfileId && !ratingSubmitted && (
          <div className="rounded-xl bg-primary/5 ring-1 ring-primary/10 p-3 space-y-3">
            <p className="text-sm font-semibold text-center">Rate your rider</p>

            {/* Stars */}
            <div className="flex flex-col items-center gap-1">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onMouseEnter={() => setHoveredStar(star)}
                    onMouseLeave={() => setHoveredStar(0)}
                    onClick={() => setRiderRating(star)}
                    className="p-0.5 transition-transform hover:scale-110"
                  >
                    <Star
                      className={`h-7 w-7 transition-colors ${
                        star <= displayRating
                          ? "fill-primary text-primary"
                          : "text-muted-foreground/30"
                      }`}
                    />
                  </button>
                ))}
              </div>
              {displayRating > 0 && (
                <span className="text-xs font-medium text-muted-foreground">
                  {ratingLabels[displayRating]}
                </span>
              )}
            </div>

            {/* Feedback Tags */}
            {riderRating > 0 && (
              <div className="flex flex-wrap gap-1.5 justify-center">
                {visibleTags.map((tag) => (
                  <button
                    key={tag.label}
                    type="button"
                    onClick={() => toggleTag(tag.label)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
                      selectedTags.includes(tag.label)
                        ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                        : "bg-secondary text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {tag.emoji} {tag.label}
                  </button>
                ))}
              </div>
            )}

            {/* Optional comment */}
            {riderRating > 0 && (
              <Textarea
                placeholder="Optional comment..."
                value={riderComment}
                onChange={(e) => setRiderComment(e.target.value.slice(0, 300))}
                rows={2}
                className="bg-secondary resize-none text-xs"
              />
            )}

            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 text-xs"
                onClick={() => setRatingSubmitted(true)}
              >
                Skip
              </Button>
              <Button
                size="sm"
                className="flex-1 text-xs"
                disabled={riderRating === 0 || submitting}
                onClick={submitRiderRating}
              >
                {submitting ? "Submitting..." : "Submit"}
              </Button>
            </div>
          </div>
        )}

        {ratingSubmitted && (
          <p className="text-xs text-center text-muted-foreground">✅ Rider rated</p>
        )}

        <Button variant="outline" className="w-full rounded-xl" onClick={onDismiss}>
          Done
        </Button>
      </div>
    </motion.div>
  );
}
