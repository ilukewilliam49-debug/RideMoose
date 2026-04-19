import { useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Download, Share2 } from "lucide-react";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { Ride } from "@/types/rider";
import logoSrc from "@/assets/logo.png";

interface RideReceiptProps {
  ride: Ride;
  driverName?: string | null;
  vehicleMake?: string | null;
  vehicleModel?: string | null;
  vehicleYear?: number | null;
  vehicleColor?: string | null;
  licensePlate?: string | null;
}

function cents(v: number) {
  return `$${(v / 100).toFixed(2)}`;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

const PICKYOU_SURCHARGE_CENTS = 299; // $2.99

export default function RideReceipt({ ride, driverName, vehicleMake, vehicleModel, vehicleYear, vehicleColor, licensePlate }: RideReceiptProps) {
  const { t } = useTranslation();
  const receiptRef = useRef<HTMLDivElement>(null);

  const isPrivateHire = ride.service_type === "private_hire";
  const grossFare = ride.final_fare_cents || Math.round((ride.final_price || 0) * 100) || Math.round((ride.estimated_price || 0) * 100);
  const serviceFee = ride.service_fee_cents || 0;
  const surchargeCents = isPrivateHire ? PICKYOU_SURCHARGE_CENTS : 0;
  const tax = ride.tax_cents || 0;
  const totalFare = grossFare + serviceFee + surchargeCents + tax;
  const captured = ride.captured_amount_cents || 0;
  const outstanding = ride.outstanding_amount_cents || 0;
  const tip = ride.tip_cents || 0;
  const tripId = ride.id.slice(0, 8).toUpperCase();
  const dateStr = format(new Date(ride.created_at), "MMM d, yyyy · h:mm a");
  const vehicleDesc = [vehicleColor, vehicleYear, vehicleMake, vehicleModel].filter(Boolean).join(" ");

  const receiptText = [
    `PickYou — Trip Receipt`,
    `Date: ${dateStr}`,
    `Trip ID: ${tripId}`,
    ``,
    `From: ${ride.pickup_address}`,
    `To: ${ride.dropoff_address}`,
    ride.distance_km ? `Distance: ${Number(ride.distance_km).toFixed(1)} km` : "",
    `Service: ${ride.service_type?.replace("_", " ")}`,
    driverName ? `Driver: ${driverName}` : "",
    vehicleDesc ? `Vehicle: ${vehicleDesc}` : "",
    licensePlate ? `Plate: ${licensePlate}` : "",
    `--- Fare Breakdown ---`,
    `Fare: ${cents(grossFare)}`,
    serviceFee > 0 ? `Service fee: ${cents(serviceFee)}` : "",
    surchargeCents > 0 ? `PickYou Surcharge: ${cents(surchargeCents)}` : "",
    tax > 0 ? `GST (5%): ${cents(tax)}` : "",
    tip > 0 ? `Tip: ${cents(tip)}` : "",
    `Total: ${cents(totalFare + tip)}`,
    ``,
    captured > 0 ? `Paid in-app: ${cents(captured)}` : "",
    outstanding > 0 ? `Due to driver: ${cents(outstanding)}` : "",
    `Payment: ${ride.payment_option.replace("_", " ")}`,
  ].filter(Boolean).join("\n");

  const generatePdf = useCallback(async () => {
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "mm", format: [80, 200] });

    const w = 80;
    const margin = 6;
    const contentW = w - margin * 2;
    let y = 8;

    // Logo
    try {
      const img = await loadImage(logoSrc);
      const logoH = 10;
      const logoW = (img.width / img.height) * logoH;
      doc.addImage(img, "PNG", (w - logoW) / 2, y, logoW, logoH);
      y += logoH + 2;
    } catch {
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("PickYou", w / 2, y + 6, { align: "center" });
      y += 10;
    }

    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120);
    doc.text("TRIP RECEIPT", w / 2, y, { align: "center" });
    y += 5;

    const dashLine = (atY: number) => {
      doc.setDrawColor(180);
      doc.setLineDashPattern([1, 1], 0);
      doc.line(margin, atY, w - margin, atY);
      doc.setLineDashPattern([], 0);
    };

    dashLine(y);
    y += 4;

    const infoRow = (label: string, value: string) => {
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(120);
      doc.text(label, margin, y);
      doc.setTextColor(40);
      doc.setFont("helvetica", "bold");
      doc.text(value, w - margin, y, { align: "right" });
      y += 4;
    };

    infoRow("Date", dateStr);
    infoRow("Trip ID", tripId);
    infoRow("Service", (ride.service_type || "").replace("_", " "));
    if (ride.distance_km) {
      infoRow("Distance", `${Number(ride.distance_km).toFixed(1)} km`);
    }
    if (driverName) infoRow("Driver", driverName);
    if (vehicleDesc) infoRow("Vehicle", vehicleDesc);
    if (licensePlate) infoRow("Plate", licensePlate);

    y += 1;
    dashLine(y);
    y += 4;

    // Route
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");

    doc.setFillColor(34, 197, 94);
    doc.circle(margin + 1.5, y - 0.8, 1, "F");
    doc.setTextColor(60);
    const pickupLines = doc.splitTextToSize(ride.pickup_address, contentW - 6);
    doc.text(pickupLines, margin + 5, y);
    y += pickupLines.length * 3 + 2;

    doc.setFillColor(124, 58, 237);
    doc.circle(margin + 1.5, y - 0.8, 1, "F");
    doc.setTextColor(60);
    const dropoffLines = doc.splitTextToSize(ride.dropoff_address, contentW - 6);
    doc.text(dropoffLines, margin + 5, y);
    y += dropoffLines.length * 3 + 2;

    y += 1;
    dashLine(y);
    y += 4;

    // Fare breakdown
    const fareRow = (label: string, value: string, bold = false, color?: [number, number, number]) => {
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(120);
      doc.text(label, margin, y);
      doc.setFont("helvetica", bold ? "bold" : "normal");
      if (color) doc.setTextColor(...color);
      else doc.setTextColor(40);
      doc.text(value, w - margin, y, { align: "right" });
      y += 4;
    };

    fareRow("Fare", cents(grossFare));
    if (serviceFee > 0) fareRow("Service fee", cents(serviceFee));
    if (surchargeCents > 0) fareRow("PickYou Surcharge", cents(surchargeCents));
    if (tax > 0) fareRow("GST (5%)", cents(tax));
    if (tip > 0) fareRow("Tip", cents(tip));

    y += 1;
    doc.setDrawColor(40);
    doc.setLineWidth(0.3);
    doc.line(margin, y, w - margin, y);
    y += 4;

    fareRow("Total", cents(totalFare + tip), true, [124, 58, 237]);

    y += 1;
    dashLine(y);
    y += 4;

    fareRow("Payment", ride.payment_option.replace("_", " "));
    if (captured > 0) fareRow("Paid in-app", cents(captured));
    if (outstanding > 0) fareRow("Due to driver", cents(outstanding), true, [234, 179, 8]);

    y += 3;

    doc.setFontSize(6);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(150);
    doc.text("Thank you for riding with PickYou!", w / 2, y, { align: "center" });
    y += 8;

    const pageHeight = y;
    (doc as any).internal.pageSize.height = pageHeight;

    return doc;
  }, [ride, grossFare, serviceFee, surchargeCents, tax, totalFare, captured, outstanding, tip, tripId, dateStr]);

  const handleDownload = useCallback(async () => {
    try {
      const doc = await generatePdf();
      doc.save(`PickYou-Receipt-${tripId}.pdf`);
      toast.success(t("receipt.downloaded", "Receipt downloaded"));
    } catch (err) {
      console.error("PDF generation error:", err);
      toast.error("Failed to generate receipt");
    }
  }, [generatePdf, tripId, t]);

  const handleShare = useCallback(async () => {
    if (navigator.share) {
      try {
        const doc = await generatePdf();
        const blob = doc.output("blob");
        const file = new File([blob], `PickYou-Receipt-${tripId}.pdf`, { type: "application/pdf" });
        await navigator.share({ title: "Trip Receipt", files: [file] });
        return;
      } catch {
        // fallback
      }
    }
    await navigator.clipboard.writeText(receiptText);
    toast.success(t("receipt.copiedToClipboard", "Receipt copied to clipboard"));
  }, [generatePdf, tripId, receiptText, t]);

  if (ride.status !== "completed" || grossFare <= 0) return null;

  return (
    <div className="space-y-3">
      <div ref={receiptRef} className="rounded-xl border border-border bg-card p-5 space-y-3">
        {/* Header */}
        <div className="text-center border-b border-dashed border-border pb-3">
          <img src={logoSrc} alt="PickYou" className="h-8 mx-auto mb-1" />
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">
            {t("receipt.tripReceipt", "Trip Receipt")}
          </p>
        </div>

        {/* Trip info */}
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("receipt.date", "Date")}</span>
            <span className="font-mono text-xs">{dateStr}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("receipt.tripId", "Trip ID")}</span>
            <span className="font-mono text-xs">{tripId}</span>
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
          {driverName && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("receipt.driver", "Driver")}</span>
              <span className="text-xs">{driverName}</span>
            </div>
          )}
          {vehicleDesc && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("receipt.vehicle", "Vehicle")}</span>
              <span className="capitalize text-xs">{vehicleDesc}</span>
            </div>
          )}
          {licensePlate && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("receipt.plate", "Plate")}</span>
              <span className="font-mono text-xs">{licensePlate}</span>
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
            <span className="text-muted-foreground">{t("receipt.fare", "Fare")}</span>
            <span className="font-mono">{cents(grossFare)}</span>
          </div>
          {serviceFee > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("receipt.serviceFee", "Service fee")}</span>
              <span className="font-mono">{cents(serviceFee)}</span>
            </div>
          )}
          {surchargeCents > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">PickYou Surcharge</span>
              <span className="font-mono">{cents(surchargeCents)}</span>
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
          {t("receipt.downloadPdf", "Download PDF")}
        </Button>
        <Button variant="outline" className="flex-1 gap-2 text-sm" onClick={handleShare}>
          <Share2 className="h-4 w-4" />
          {t("receipt.share", "Share")}
        </Button>
      </div>
    </div>
  );
}
