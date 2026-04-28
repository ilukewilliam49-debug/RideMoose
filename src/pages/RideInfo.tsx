import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { Car, Sparkles, Users, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import LandingNav from "@/components/landing/LandingNav";
import LandingFooter from "@/components/landing/LandingFooter";
import PassengerCountPicker from "@/components/rider/PassengerCountPicker";
import { usePassengerCount } from "@/hooks/usePassengerCount";
import { useSearchParams } from "react-router-dom";

const BASE_FARE = 8.20;
const PER_KM = 3.00;
const SAMPLE_KM = 5;
const VAN_SURCHARGE = 6.00;
const GST_RATE = 0.05;

const RideInfo = () => {
  const [searchParams] = useSearchParams();
  const [passengers, setPassengers] = usePassengerCount(2);

  // Hydrate from ?passengers= URL param if present (e.g. deep links).
  useEffect(() => {
    const p = searchParams.get("passengers");
    if (!p) return;
    const parsed = parseInt(p, 10);
    if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 6) {
      setPassengers(parsed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const { taxiTotal, pickyouTotal, vanApplied } = useMemo(() => {
    const subtotal = BASE_FARE + PER_KM * SAMPLE_KM;
    const surcharge = passengers >= 5 ? VAN_SURCHARGE : 0;
    const taxi = subtotal + surcharge; // tax-exempt
    const pickyouSubtotal = subtotal + surcharge;
    const pickyou = pickyouSubtotal * (1 + GST_RATE);
    return {
      taxiTotal: taxi,
      pickyouTotal: pickyou,
      vanApplied: surcharge > 0,
    };
  }, [passengers]);

  useEffect(() => {
    window.scrollTo(0, 0);
    const prevTitle = document.title;
    document.title = "Ride Services in Yellowknife — Taxi & PickYou | PickYou";
    return () => { document.title = prevTitle; };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <LandingNav />

      <main className="mx-auto max-w-6xl px-5 lg:px-8 py-12 md:py-20">
        {/* Hero */}
        <section className="text-center space-y-4 mb-14">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            Two ways to ride in Yellowknife
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Choose a traditional metered <strong>Taxi</strong> or book a flexible
            <strong> PickYou</strong> independent driver — all in one app.
          </p>
        </section>

        {/* Two service cards */}
        <section className="grid gap-6 md:grid-cols-2 mb-16">
          <Card className="p-7 space-y-4 border-2 hover:border-primary/40 transition-colors">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Car className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Taxi</h2>
                <p className="text-sm text-muted-foreground">Traditional metered service</p>
              </div>
            </div>
            <ul className="space-y-2 text-sm">
              <li className="flex gap-2"><Check className="h-4 w-4 text-primary mt-0.5 shrink-0" /> Licensed taxi operators</li>
              <li className="flex gap-2"><Check className="h-4 w-4 text-primary mt-0.5 shrink-0" /> Regulated meter rates — tax-exempt</li>
              <li className="flex gap-2"><Check className="h-4 w-4 text-primary mt-0.5 shrink-0" /> Cash or card accepted</li>
              <li className="flex gap-2"><Check className="h-4 w-4 text-primary mt-0.5 shrink-0" /> 24/7 dispatch</li>
            </ul>
          </Card>

          <Card className="p-7 space-y-4 border-2 hover:border-accent/40 transition-colors">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-accent/10 flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-accent" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">PickYou</h2>
                <p className="text-sm text-muted-foreground">Independent contractor drivers</p>
              </div>
            </div>
            <ul className="space-y-2 text-sm">
              <li className="flex gap-2"><Check className="h-4 w-4 text-accent mt-0.5 shrink-0" /> Vetted independent drivers</li>
              <li className="flex gap-2"><Check className="h-4 w-4 text-accent mt-0.5 shrink-0" /> Same metered rate + 5% GST</li>
              <li className="flex gap-2"><Check className="h-4 w-4 text-accent mt-0.5 shrink-0" /> In-app payment, tipping, ratings</li>
              <li className="flex gap-2"><Check className="h-4 w-4 text-accent mt-0.5 shrink-0" /> Live tracking & ETA</li>
            </ul>
          </Card>
        </section>

        {/* Estimator with passenger picker */}
        <section className="mb-16">
          <Card className="p-6 md:p-8 space-y-6">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold">Estimate your fare</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Sample {SAMPLE_KM} km trip — actual fare varies by distance and time.
              Groups of 5 or 6 passengers automatically use a van with a +${VAN_SURCHARGE.toFixed(2)} surcharge.
            </p>

            <PassengerCountPicker value={passengers} onChange={setPassengers} max={6} />

            <div className="grid gap-3 sm:grid-cols-2 pt-2">
              <div className="rounded-xl bg-secondary/50 p-4 space-y-1">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Taxi</p>
                <p className="text-2xl font-bold">${taxiTotal.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Tax-exempt</p>
              </div>
              <div className="rounded-xl bg-secondary/50 p-4 space-y-1">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">PickYou</p>
                <p className="text-2xl font-bold">${pickyouTotal.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Includes 5% GST</p>
              </div>
            </div>

            {vanApplied && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-600">
                Van price applied: +${VAN_SURCHARGE.toFixed(2)} for groups of {passengers}.
              </div>
            )}

            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link to="/login">
                Book a ride <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </Card>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
};

export default RideInfo;
