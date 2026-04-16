import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Power, MapPin, DollarSign, ArrowRight, PartyPopper } from "lucide-react";

const STORAGE_KEY = "pickyou.driver.welcomeSeen.v1";

const SLIDES = [
  {
    icon: Power,
    title: "Go online to start earning",
    body: "Tap the green button on your dashboard to receive ride requests in real time.",
  },
  {
    icon: MapPin,
    title: "Accept and navigate",
    body: "We'll send you the pickup details with one-tap navigation. Most drivers accept within 10 seconds.",
  },
  {
    icon: DollarSign,
    title: "Get paid weekly",
    body: "Earnings are tracked instantly. Request payouts from the Earnings tab — paid out weekly to your bank.",
  },
] as const;

const DriverWelcomeFlow = () => {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!profile?.id) return;
    const key = `${STORAGE_KEY}.${profile.id}`;
    if (!localStorage.getItem(key)) {
      // Small delay so dashboard renders first
      const t = setTimeout(() => setOpen(true), 600);
      return () => clearTimeout(t);
    }
  }, [profile?.id]);

  const dismiss = () => {
    if (profile?.id) {
      localStorage.setItem(`${STORAGE_KEY}.${profile.id}`, "1");
    }
    setOpen(false);
  };

  const handleNext = () => {
    if (step < SLIDES.length) setStep((s) => s + 1);
    else dismiss();
  };

  const isCelebration = step === 0;
  const slideIdx = step - 1;
  const slide = SLIDES[slideIdx];
  const Icon = slide?.icon;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && dismiss()}>
      <DialogContent className="max-w-md p-0 overflow-hidden border-border/50">
        <div
          className="p-6 text-center"
          style={{
            background:
              "linear-gradient(135deg, hsl(222 35% 10% / 0.95), hsl(222 40% 7% / 0.98))",
          }}
        >
          <AnimatePresence mode="wait">
            {isCelebration ? (
              <motion.div
                key="celebrate"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.25 }}
              >
                <motion.div
                  initial={{ scale: 0, rotate: -30 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 220, damping: 14 }}
                  className="mx-auto w-20 h-20 rounded-full bg-primary/15 flex items-center justify-center mb-4"
                >
                  <CheckCircle2 className="h-10 w-10 text-primary" />
                </motion.div>
                <div className="flex items-center justify-center gap-2 text-primary mb-2">
                  <PartyPopper className="h-4 w-4" />
                  <span className="text-xs font-medium uppercase tracking-wide">
                    You're approved
                  </span>
                </div>
                <h2 className="text-2xl font-semibold text-foreground">
                  Welcome to PickYou{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}!
                </h2>
                <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
                  Your application has been approved. Let's walk through how to take
                  your first ride.
                </p>
              </motion.div>
            ) : (
              <motion.div
                key={`slide-${slideIdx}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
              >
                {Icon && (
                  <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <Icon className="h-8 w-8 text-primary" />
                  </div>
                )}
                <h2 className="text-xl font-semibold text-foreground">
                  {slide?.title}
                </h2>
                <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
                  {slide?.body}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Progress dots */}
          <div className="flex items-center justify-center gap-1.5 mt-6">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? "w-6 bg-primary" : "w-1.5 bg-muted"
                }`}
              />
            ))}
          </div>

          <div className="mt-5 flex flex-col gap-2">
            <Button onClick={handleNext} className="w-full">
              {step < SLIDES.length ? (
                <>
                  Next
                  <ArrowRight className="h-4 w-4 ml-1.5" />
                </>
              ) : (
                <>
                  Go online
                  <Power className="h-4 w-4 ml-1.5" />
                </>
              )}
            </Button>
            {step < SLIDES.length && (
              <button
                onClick={dismiss}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Skip tour
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DriverWelcomeFlow;
