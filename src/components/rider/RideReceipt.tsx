import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Download, Share2 } from "lucide-react";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { Ride } from "@/types/rider";

interface RideReceiptProps {
  ride: Ride;
}

function cents(v: number) {
  return `$${(v / 100).toFixed(2)}`;
}

export default function RideReceipt({ ride }: RideReceiptProps) {
  const { t } = useTranslation();
  const receiptRef = useRef<HTMLDivElement>(null);

  const totalFare = ride.final_fare_cents || Math.round((ride.final_price || 0) * 100) || Math.round((ride.estimated_price || 0) * 100);
  const serviceFee = ride.service_fee_cents || 0;
  const tax = ride.tax_cents || 0;
  const subtotal = totalFare - serviceFee - tax;
  const captured = ride.captured_amount_cents || 0;
  const outstanding = ride.outstanding_amount_cents || 0;
  const tip = ride.tip_cents || 0;

  const receiptText = [
    `PickYou — Trip Receipt`,
    `Date: ${format(new Date(ride.created_at), "MMM d, yyyy · h:mm a")}`,
    `Trip ID: ${ride.id.slice(0, 8).toUpperCase()}`,
    ``,
    `From: ${ride.pickup_address}`,
    `To: ${ride.dropoff_address}`,
    ride.distance_km ? `Distance: ${Number(ride.distance_km).toFixed(1)} km` : "",
    `Service: ${ride.service_type?.replace("_", " ")}`,
    ``,
    `--- Fare Breakdown ---`,
    `Subtotal: ${cents(subtotal)}`,
    serviceFee > 0 ? `Service fee: ${cents(serviceFee)}` : "",
    tax > 0 ? `GST (5%): ${cents(tax)}` : "",
    tip > 0 ? `Tip: ${cents(tip)}` : "",
    `Total: ${cents(totalFare + tip)}`,
    ``,
    captured > 0 ? `Paid in-app: ${cents(captured)}` : "",
    outstanding > 0 ? `Due to driver: ${cents(outstanding)}` : "",
    `Payment: ${ride.payment_option.replace("_", " ")}`,
  ].filter(Boolean).join("\n");

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Trip Receipt", text: receiptText });
      } catch {
        // user cancelled
      }
    } else {
      await navigator.clipboard.writeText(receiptText);
      toast.success(t("receipt.copiedToClipboard", "Receipt copied to clipboard"));
    }
  };

  const handleDownload = () => {
    const blob = new Blob([receiptText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `PickYou-Receipt-${ride.id.slice(0, 8).toUpperCase()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t("receipt.downloaded", "Receipt downloaded"));
  };

  if (ride.status !== "completed" || totalFare <= 0) return null;

  return (
    <div className="space-y-3">
      <div ref={receiptRef} className="rounded-xl border border-border bg-card p-5 space-y-3">
        {/* Header */}
        <div className="text-center border-b border-dashed border-border pb-3">
          <h3 className="text-base font-bold text-foreground">PickYou</h3>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">
            {t("receipt.tripReceipt", "Trip Receipt")}
          </p>
        </div>

        {/* Trip info */}
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("receipt.date", "Date")}</span>
            <span className="font-mono text-xs">{format(new Date(ride.created_at), "MMM d, yyyy · h:mm a")}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("receipt.tripId", "Trip ID")}</span>
            <span className="font-mono text-xs">{ride.id.slice(0, 8).toUpperCase()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("receipt.service", "Service")}</span>
            <span className="capitalize text-xs">{ride.service_type?.replace("_", " ")}</span>
          </div>
          {ride.distance_km && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("receipt.distance", "Distance")}</span>
              <span className="font-mono text-xs">{Number(ride.distance_km).toFixed(1)} km</span>
            </div>
          )}
        </div>

        {/* Route */}
        <div className="space-y-1.5 text-xs border-t border-dashed border-border pt-3">
          <div className="flex items-start gap-2">
            <div className="mt-1 h-2 w-2 rounded-full bg-green-500 shrink-0" />
            <span>{ride.pickup_address}</span>
          </div>
          <div className="flex items-start gap-2">
            <div className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0" />
            <span>{ride.dropoff_address}</span>
          </div>
        </div>

        {/* Fare breakdown */}
        <div className="border-t border-dashed border-border pt-3 space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("receipt.subtotal", "Subtotal")}</span>
            <span className="font-mono">{cents(subtotal)}</span>
          </div>
          {serviceFee > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("receipt.serviceFee", "Service fee")}</span>
              <span className="font-mono">{cents(serviceFee)}</span>
            </div>
          )}
          {tax > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("receipt.gst", "GST (5%)")}</span>
              <span className="font-mono">{cents(tax)}</span>
            </div>
          )}
          {tip > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("receipt.tip", "Tip")}</span>
              <span className="font-mono">{cents(tip)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-border pt-2 font-bold">
            <span>{t("receipt.total", "Total")}</span>
            <span className="font-mono text-primary">{cents(totalFare + tip)}</span>
          </div>
        </div>

        {/* Payment info */}
        <div className="border-t border-dashed border-border pt-3 space-y-1 text-xs text-muted-foreground">
          <div className="flex justify-between">
            <span>{t("receipt.paymentMethod", "Payment")}</span>
            <span className="capitalize">{ride.payment_option.replace("_", " ")}</span>
          </div>
          {captured > 0 && (
            <div className="flex justify-between">
              <span>{t("receipt.paidInApp", "Paid in-app")}</span>
              <span className="font-mono">{cents(captured)}</span>
            </div>
          )}
          {outstanding > 0 && (
            <div className="flex justify-between text-yellow-500">
              <span>{t("receipt.dueToDriver", "Due to driver")}</span>
              <span className="font-mono font-semibold">{cents(outstanding)}</span>
            </div>
          )}
        </div>

        <p className="text-center text-[10px] text-muted-foreground pt-2">
          {t("receipt.thankYou", "Thank you for riding with PickYou!")}
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1 gap-2 text-sm" onClick={handleDownload}>
          <Download className="h-4 w-4" />
          {t("receipt.download", "Download")}
        </Button>
        <Button variant="outline" className="flex-1 gap-2 text-sm" onClick={handleShare}>
          <Share2 className="h-4 w-4" />
          {t("receipt.share", "Share")}
        </Button>
      </div>
    </div>
  );
}
