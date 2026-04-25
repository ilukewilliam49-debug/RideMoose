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
import { Loader2, CreditCard, CheckCircle, ChevronDown } from "lucide-react";
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

interface SavedCard {
  id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
}

function brandIcon(brand: string) {
  const b = brand.toLowerCase();
  if (b === "visa") return "💳 Visa";
  if (b === "mastercard") return "💳 Mastercard";
  if (b === "amex") return "💳 Amex";
  return `💳 ${brand.charAt(0).toUpperCase() + brand.slice(1)}`;
}

function SavedCardSelector({
  cards,
  selectedId,
  onSelect,
  onUseNew,
  useNewSelected,
}: {
  cards: SavedCard[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onUseNew: () => void;
  useNewSelected?: boolean;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  // Find the currently selected card
  const activeCard = cards.find((c) => c.id === selectedId);

  // Collapsed view: show selected card with expand toggle
  if (!expanded && activeCard && !useNewSelected) {
    return (
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex items-center gap-3 w-full p-3 rounded-lg border border-primary bg-primary/10 transition-all"
        >
          <CreditCard className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium flex-1 text-left">
            {brandIcon(activeCard.brand)} •••• {activeCard.last4}
          </span>
          <span className="text-xs text-muted-foreground">
            {String(activeCard.exp_month).padStart(2, "0")}/{String(activeCard.exp_year).slice(-2)}
          </span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>
        <button
          type="button"
          onClick={onUseNew}
          className="text-xs text-primary hover:underline w-full text-center py-1"
        >
          {t("payment.useNewCard", "Use a new card")}
        </button>
      </div>
    );
  }

  // Expanded view: show all cards + new card option
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {t("payment.savedCards", "Saved Cards")}
      </p>
      {cards.map((card) => (
        <button
          key={card.id}
          type="button"
          onClick={() => { onSelect(card.id); setExpanded(false); }}
          className={`flex items-center gap-3 w-full p-3 rounded-lg border transition-all ${
            selectedId === card.id && !useNewSelected
              ? "border-primary bg-primary/10"
              : "border-border bg-secondary hover:bg-accent"
          }`}
        >
          <CreditCard className={`h-4 w-4 ${selectedId === card.id && !useNewSelected ? "text-primary" : "text-muted-foreground"}`} />
          <span className="text-sm font-medium flex-1 text-left">
            {brandIcon(card.brand)} •••• {card.last4}
          </span>
          <span className="text-xs text-muted-foreground">
            {String(card.exp_month).padStart(2, "0")}/{String(card.exp_year).slice(-2)}
          </span>
          <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${selectedId === card.id && !useNewSelected ? "border-primary" : "border-muted-foreground"}`}>
            {selectedId === card.id && !useNewSelected && <div className="h-2 w-2 rounded-full bg-primary" />}
          </div>
        </button>
      ))}
      <button
        type="button"
        onClick={() => { onUseNew(); setExpanded(false); }}
        className={`flex items-center gap-3 w-full p-3 rounded-lg border transition-all ${
          useNewSelected
            ? "border-primary bg-primary/10"
            : "border-border bg-secondary hover:bg-accent"
        }`}
      >
        <CreditCard className={`h-4 w-4 ${useNewSelected ? "text-primary" : "text-muted-foreground"}`} />
        <span className="text-sm font-medium flex-1 text-left">
          {t("payment.useNewCard", "Use a new card")}
        </span>
        <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${useNewSelected ? "border-primary" : "border-muted-foreground"}`}>
          {useNewSelected && <div className="h-2 w-2 rounded-full bg-primary" />}
        </div>
      </button>
    </div>
  );
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
  rideId?: string;
  serviceType?: string;
  estimatedFareCents?: number;
  onSavedCardSuccess?: () => void;
}

export default function PaymentConfirmation({
  clientSecret,
  amountCents,
  onSuccess,
  onFailure,
  label,
  rideId,
  serviceType,
  estimatedFareCents,
  onSavedCardSuccess,
}: PaymentConfirmationProps) {
  const [savedCards, setSavedCards] = useState<SavedCard[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [loadingCards, setLoadingCards] = useState(true);
  const [payingWithSaved, setPayingWithSaved] = useState(false);
  const [succeeded, setSucceeded] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("list-payment-methods");
        if (!error && data?.cards?.length > 0) {
          setSavedCards(data.cards);
          setSelectedCardId(data.cards[0].id);
        }
      } catch {
        // ignore — just show new card form
      } finally {
        setLoadingCards(false);
      }
    })();
  }, []);

  const handlePayWithSavedCard = async () => {
    if (!selectedCardId || !rideId) return;
    setPayingWithSaved(true);
    try {
      const subtotal = estimatedFareCents || amountCents;
      const subtotalCheck = validateFareSubtotalCents(subtotal, {
        serviceType: serviceType || "taxi",
      });
      if (!subtotalCheck.ok) {
        toast.error(subtotalCheck.message);
        setPayingWithSaved(false);
        onFailure?.();
        return;
      }
      const { data, error } = await supabase.functions.invoke("pay-with-saved-card", {
        body: {
          ride_id: rideId,
          payment_method_id: selectedCardId,
          estimated_fare_cents: subtotalCheck.subtotalCents,
          service_type: serviceType || "taxi",
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setSucceeded(true);
      toast.success(t("payment.paymentAuthorized") + "!");
      (onSavedCardSuccess || onSuccess)();
    } catch (err: any) {
      toast.error(err.message || "Payment failed");
      onFailure?.();
    } finally {
      setPayingWithSaved(false);
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

  if (loadingCards) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  // If saved cards exist and one is selected, show saved card flow
  if (savedCards.length > 0 && selectedCardId) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">{label || t("payment.authorizePayment")}</span>
          </div>
          <span className="text-sm font-mono font-bold">
            ${(amountCents / 100).toFixed(2)} CAD
          </span>
        </div>

        <SavedCardSelector
          cards={savedCards}
          selectedId={selectedCardId}
          onSelect={setSelectedCardId}
          onUseNew={() => setSelectedCardId(null)}
        />

        <Button
          onClick={handlePayWithSavedCard}
          disabled={payingWithSaved || !rideId}
          className="w-full gap-2"
        >
          {payingWithSaved ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> {t("payment.processing")}</>
          ) : (
            `${t("payment.authorize")} $${(amountCents / 100).toFixed(2)}`
          )}
        </Button>
        <p className="text-[10px] text-muted-foreground text-center">
          {t("payment.chargeNote")}
        </p>
      </div>
    );
  }

  // No saved cards or user chose "new card" — show Stripe Elements
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
    <div className="space-y-4">
      {savedCards.length > 0 && (
        <SavedCardSelector
          cards={savedCards}
          selectedId={null}
          onSelect={setSelectedCardId}
          onUseNew={() => setSelectedCardId(null)}
          useNewSelected
        />
      )}
      <Elements stripe={getStripe()} options={options}>
        <PaymentForm onSuccess={onSuccess} onFailure={onFailure} amountCents={amountCents} label={label} />
      </Elements>
    </div>
  );
}
