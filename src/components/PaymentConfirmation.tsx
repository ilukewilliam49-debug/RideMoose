import { useState, useEffect } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, CreditCard, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";

let stripePromise: Promise<Stripe | null> | null = null;

function getStripe() {
  if (!stripePromise) {
    stripePromise = supabase.functions
      .invoke("get-stripe-key")
      .then(({ data }) => loadStripe(data?.publishableKey || ""));
  }
  return stripePromise;
}

function PaymentForm({
  onSuccess,
  onFailure,
  amountCents,
  label,
}: {
  onSuccess: () => void;
  onFailure?: () => void;
  amountCents: number;
  label?: string;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [succeeded, setSucceeded] = useState(false);
  const { t } = useTranslation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.href,
      },
      redirect: "if_required",
    });

    if (error) {
      toast.error(error.message || "Payment failed");
      setProcessing(false);
      onFailure?.();
    } else {
      setSucceeded(true);
      setProcessing(false);
      toast.success(t("payment.paymentAuthorized") + "!");
      onSuccess();
    }
  };

  if (succeeded) {
    return (
      <div className="flex flex-col items-center gap-2 py-4">
        <CheckCircle className="h-8 w-8 text-green-500" />
        <p className="text-sm font-medium text-green-600">{t("payment.paymentAuthorized")}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-lg border border-border p-4 bg-background">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">{label || t("payment.authorizePayment")}</span>
          </div>
          <span className="text-sm font-mono font-bold">
            ${(amountCents / 100).toFixed(2)} CAD
          </span>
        </div>
        <PaymentElement />
      </div>
      <Button
        type="submit"
        disabled={!stripe || processing}
        className="w-full gap-2"
      >
        {processing ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> {t("payment.processing")}</>
        ) : (
          `${t("payment.authorize")} $${(amountCents / 100).toFixed(2)}`
        )}
      </Button>
      <p className="text-[10px] text-muted-foreground text-center">
        {t("payment.chargeNote")}
      </p>
    </form>
  );
}

interface PaymentConfirmationProps {
  clientSecret: string;
  amountCents: number;
  onSuccess: () => void;
  onFailure?: () => void;
  label?: string;
}

export default function PaymentConfirmation({
  clientSecret,
  amountCents,
  onSuccess,
  onFailure,
  label,
}: PaymentConfirmationProps) {
  const options = {
    clientSecret,
    appearance: {
      theme: "night" as const,
      variables: {
        colorPrimary: "#22c55e",
        borderRadius: "8px",
      },
    },
  };

  return (
    <Elements stripe={getStripe()} options={options}>
      <PaymentForm onSuccess={onSuccess} onFailure={onFailure} amountCents={amountCents} label={label} />
    </Elements>
  );
}
