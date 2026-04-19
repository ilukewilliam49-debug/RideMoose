import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Star, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface RateData {
  status: string;
  completed_at: string | null;
  guest_name: string | null;
  driver_name: string;
  driver_avatar: string | null;
  already_rated: boolean;
  can_rate: boolean;
}

export default function GuestRate() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<RateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const apiBase = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/guest-rate`;
  const apiKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${apiBase}?token=${encodeURIComponent(token)}`, {
          headers: { apikey: apiKey },
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Could not load");
        if (!cancelled) {
          setData(json);
          if (json.already_rated) setSubmitted(true);
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message || "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, apiBase, apiKey]);

  const submit = async () => {
    if (!token || rating < 1 || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: apiKey },
        body: JSON.stringify({ token, rating, comment: comment || undefined }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Could not submit rating");
      setSubmitted(true);
      toast.success("Thanks for your feedback!");
    } catch (e: any) {
      toast.error(e.message || "Couldn't submit your rating");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="p-6 max-w-sm w-full text-center space-y-3">
          <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
          <h1 className="text-lg font-semibold">Trip not found</h1>
          <p className="text-sm text-muted-foreground">
            This rating link may be invalid or expired.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50">
        <div className="max-w-md mx-auto px-4 py-4">
          <h1 className="text-lg font-bold tracking-tight">PickYou</h1>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-8 space-y-5">
        {submitted ? (
          <Card className="p-6 text-center space-y-3">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
            <h2 className="text-xl font-semibold">Thanks for rating your trip!</h2>
            <p className="text-sm text-muted-foreground">
              Your feedback helps us keep PickYou drivers great.
            </p>
          </Card>
        ) : !data.can_rate ? (
          <Card className="p-6 text-center space-y-3">
            <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto" />
            <h2 className="text-lg font-semibold">Rating not available</h2>
            <p className="text-sm text-muted-foreground">
              This trip can't be rated right now.
            </p>
          </Card>
        ) : (
          <>
            <div className="text-center space-y-2">
              {data.guest_name && (
                <p className="text-sm text-muted-foreground">
                  Hi {data.guest_name.split(" ")[0]} 👋
                </p>
              )}
              <h2 className="text-2xl font-semibold">How was your ride with {data.driver_name}?</h2>
              <p className="text-sm text-muted-foreground">Tap a star to rate.</p>
            </div>

            <Card className="p-6 space-y-5">
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((n) => {
                  const active = (hover || rating) >= n;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRating(n)}
                      onMouseEnter={() => setHover(n)}
                      onMouseLeave={() => setHover(0)}
                      className="p-1 transition-transform hover:scale-110"
                      aria-label={`${n} star${n > 1 ? "s" : ""}`}
                    >
                      <Star
                        className={`h-10 w-10 ${
                          active ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"
                        }`}
                      />
                    </button>
                  );
                })}
              </div>

              {rating > 0 && (
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Add a comment (optional)"
                  rows={3}
                  maxLength={500}
                />
              )}

              <Button
                onClick={submit}
                disabled={rating < 1 || submitting}
                className="w-full"
                size="lg"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit rating"}
              </Button>
            </Card>
          </>
        )}

        <p className="text-[11px] text-center text-muted-foreground pt-2">
          No account required.
        </p>
      </main>
    </div>
  );
}
