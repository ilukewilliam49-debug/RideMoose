import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { useTranslation } from "react-i18next";

const CANCEL_REASONS = [
  { key: "changed_plans", label: "Changed my plans" },
  { key: "driver_too_far", label: "Driver is too far away" },
  { key: "wrong_address", label: "Wrong address entered" },
  { key: "found_other_ride", label: "Found another ride" },
  { key: "too_long_wait", label: "Wait time too long" },
  { key: "other", label: "Other reason" },
];

interface CancelRideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rideId: string;
  rideStatus: string;
  driverAccepted: boolean;
  onCancelled?: () => void;
}

export default function CancelRideDialog({
  open,
  onOpenChange,
  rideId,
  rideStatus,
  driverAccepted,
  onCancelled,
}: CancelRideDialogProps) {
  const { t } = useTranslation();
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  // Fee only applies when driver has already accepted
  const cancellationFeeCents = driverAccepted ? 500 : 0;

  const handleCancel = async () => {
    if (!selectedReason) {
      toast.error("Please select a reason");
      return;
    }
    setCancelling(true);
    try {
      const { error } = await supabase
        .from("rides")
        .update({
          status: "cancelled" as any,
          cancellation_reason: selectedReason,
          cancellation_fee_cents: cancellationFeeCents,
        } as any)
        .eq("id", rideId);
      if (error) throw error;
      toast.success(t("rider.rideCancelled"));
      onOpenChange(false);
      onCancelled?.();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCancelling(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel Ride</AlertDialogTitle>
          <AlertDialogDescription>
            Why are you cancelling?
            {cancellationFeeCents > 0 && (
              <span className="block mt-1 text-amber-500 font-medium">
                A ${(cancellationFeeCents / 100).toFixed(2)} cancellation fee applies since the driver has already accepted.
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 py-2">
          {CANCEL_REASONS.map((reason) => (
            <button
              key={reason.key}
              onClick={() => setSelectedReason(reason.key)}
              className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                selectedReason === reason.key
                  ? "bg-primary/10 text-primary ring-1 ring-primary/30"
                  : "bg-secondary hover:bg-accent"
              }`}
            >
              {reason.label}
            </button>
          ))}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Keep Ride</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={cancelling || !selectedReason}
            onClick={handleCancel}
          >
            {cancelling ? "Cancelling..." : cancellationFeeCents > 0 ? `Cancel ($${(cancellationFeeCents / 100).toFixed(2)} fee)` : "Cancel Ride"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
