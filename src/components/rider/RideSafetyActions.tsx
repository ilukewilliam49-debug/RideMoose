import { useState } from "react";
import { ShieldAlert, Share2, Phone, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface RideSafetyActionsProps {
  rideId: string;
  pickupAddress: string;
  dropoffAddress: string;
  driverName?: string | null;
  serviceType?: string;
}

const EMERGENCY_NUMBER = "911";

const RideSafetyActions = ({
  rideId,
  pickupAddress,
  dropoffAddress,
  driverName,
  serviceType,
}: RideSafetyActionsProps) => {
  const [sosOpen, setSosOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);

  const buildShareMessage = (trackUrl: string | null) =>
    [
      `🚗 I'm on a PickYou ${serviceType || "ride"}`,
      driverName ? `Driver: ${driverName}` : null,
      `From: ${pickupAddress}`,
      `To: ${dropoffAddress}`,
      trackUrl ? `Track live: ${trackUrl}` : `Ride ID: ${rideId.slice(0, 8)}`,
    ]
      .filter(Boolean)
      .join("\n");

  const handleShare = async () => {
    setSharing(true);
    let trackUrl: string | null = null;
    try {
      const { data: token, error } = await supabase.rpc("ensure_ride_track_token", {
        _ride_id: rideId,
      });
      if (error) throw error;
      if (token) {
        trackUrl = `${window.location.origin}/t/${token}`;
      }
    } catch (err) {
      console.error("Failed to generate tracking link", err);
      // Fall through and share without a link
    }

    const shareMessage = buildShareMessage(trackUrl);

    if (navigator.share) {
      try {
        await navigator.share({
          title: "My PickYou Trip",
          text: shareMessage,
          url: trackUrl || undefined,
        });
      } catch {
        // User cancelled share — do nothing
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareMessage);
        setCopied(true);
        toast.success(
          trackUrl ? "Tracking link copied to clipboard" : "Trip details copied to clipboard"
        );
        setTimeout(() => setCopied(false), 2000);
      } catch {
        toast.error("Could not copy to clipboard");
      }
    }
    setSharing(false);
  };

  const handleCallEmergency = () => {
    window.open(`tel:${EMERGENCY_NUMBER}`, "_self");
  };

  return (
    <div className="flex gap-2">
      {/* SOS Button */}
      <Dialog open={sosOpen} onOpenChange={setSosOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive hover:text-destructive-foreground"
          >
            <ShieldAlert className="h-4 w-4" />
            SOS
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-[340px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" />
              Emergency SOS
            </DialogTitle>
            <DialogDescription>
              If you feel unsafe, call emergency services immediately. Your trip
              details will be available to dispatchers.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="rounded-lg bg-destructive/5 ring-1 ring-destructive/20 p-3 space-y-1 text-sm">
              <p className="font-medium">Trip details</p>
              <p className="text-muted-foreground text-xs">
                From: {pickupAddress}
              </p>
              <p className="text-muted-foreground text-xs">
                To: {dropoffAddress}
              </p>
              {driverName && (
                <p className="text-muted-foreground text-xs">
                  Driver: {driverName}
                </p>
              )}
              <p className="text-muted-foreground text-xs font-mono">
                ID: {rideId.slice(0, 8)}
              </p>
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              variant="destructive"
              className="w-full gap-2"
              onClick={handleCallEmergency}
            >
              <Phone className="h-4 w-4" />
              Call {EMERGENCY_NUMBER}
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setSosOpen(false)}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share Trip Button */}
      <Button variant="outline" size="sm" className="gap-1.5" onClick={handleShare}>
        {copied ? (
          <Check className="h-4 w-4 text-green-500" />
        ) : (
          <Share2 className="h-4 w-4" />
        )}
        Share trip
      </Button>
    </div>
  );
};

export default RideSafetyActions;
