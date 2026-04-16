import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowRight, TrendingUp } from "lucide-react";

// Yellowknife benchmark: ~$28/hr gross before commission
const GROSS_PER_HOUR = 28;
const COMMISSION_RATE = 0.049; // 4.9% standard

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(n);

const EarningsCalculator = () => {
  const navigate = useNavigate();
  const [hoursPerDay, setHoursPerDay] = useState(6);
  const [daysPerWeek, setDaysPerWeek] = useState(5);

  const { weekly, monthly, hoursPerWeek } = useMemo(() => {
    const hpw = hoursPerDay * daysPerWeek;
    const grossWeekly = hpw * GROSS_PER_HOUR;
    const netWeekly = grossWeekly * (1 - COMMISSION_RATE);
    return {
      hoursPerWeek: hpw,
      weekly: netWeekly,
      monthly: netWeekly * 4.33,
    };
  }, [hoursPerDay, daysPerWeek]);

  return (
    <section className="border-b border-border/30 bg-card/20">
      <div className="mx-auto max-w-7xl px-5 lg:px-8 py-16 md:py-24">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45 }}
          className="text-center max-w-2xl mx-auto mb-10"
        >
          <p className="text-[11px] font-semibold uppercase tracking-widest text-primary mb-2">
            Earnings calculator
          </p>
          <h2 className="text-3xl md:text-4xl font-black tracking-tight">See what you could earn</h2>
          <p className="mt-3 text-[15px] text-muted-foreground">
            Drag the sliders to estimate your take-home pay based on your schedule.
          </p>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-2 max-w-4xl mx-auto">
          {/* Sliders */}
          <Card className="p-6 md:p-8 space-y-8 bg-card/60 ring-1 ring-border/30">
            <div>
              <div className="flex items-baseline justify-between mb-3">
                <label className="text-sm font-semibold">Hours per day</label>
                <span className="text-2xl font-black tracking-tight text-primary">{hoursPerDay}h</span>
              </div>
              <Slider
                value={[hoursPerDay]}
                onValueChange={(v) => setHoursPerDay(v[0])}
                min={1}
                max={12}
                step={1}
              />
              <div className="flex justify-between text-[11px] text-muted-foreground mt-2">
                <span>1h</span>
                <span>12h</span>
              </div>
            </div>

            <div>
              <div className="flex items-baseline justify-between mb-3">
                <label className="text-sm font-semibold">Days per week</label>
                <span className="text-2xl font-black tracking-tight text-primary">{daysPerWeek}</span>
              </div>
              <Slider
                value={[daysPerWeek]}
                onValueChange={(v) => setDaysPerWeek(v[0])}
                min={1}
                max={7}
                step={1}
              />
              <div className="flex justify-between text-[11px] text-muted-foreground mt-2">
                <span>1 day</span>
                <span>7 days</span>
              </div>
            </div>

            <div className="text-center pt-2 border-t border-border/30">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {hoursPerWeek} hours / week
              </p>
            </div>
          </Card>

          {/* Results */}
          <Card className="p-6 md:p-8 bg-gradient-to-br from-primary/15 to-primary/5 ring-1 ring-primary/20 flex flex-col justify-center">
            <div className="flex items-center gap-2 text-primary mb-4">
              <TrendingUp className="h-4 w-4" />
              <span className="text-[11px] font-bold uppercase tracking-widest">Your estimate</span>
            </div>

            <div className="space-y-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Weekly take-home
                </p>
                <p className="text-4xl md:text-5xl font-black tracking-tight">{formatCurrency(weekly)}</p>
              </div>

              <div className="h-px bg-border/40" />

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Monthly take-home
                </p>
                <p className="text-2xl md:text-3xl font-black tracking-tight">{formatCurrency(monthly)}</p>
              </div>

              <p className="text-[11px] leading-relaxed text-muted-foreground pt-2">
                Estimate only. Actual earnings vary by demand, tips, time of day, service mix, and driving efficiency. Based on a 4.9% platform commission.
              </p>

              <Button
                className="w-full h-12 rounded-xl font-bold mt-2"
                onClick={() => navigate("/login?role=driver")}
              >
                Start earning
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
};

export default EarningsCalculator;
