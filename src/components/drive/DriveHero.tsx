import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ChevronDown } from "lucide-react";
import driverHero from "@/assets/driver-hero.jpg";

const DriveHero = () => {
  const navigate = useNavigate();

  return (
    <section className="relative overflow-hidden border-b border-border/30">
      {/* Background image */}
      <div className="absolute inset-0">
        <img
          src={driverHero}
          alt="PickYou driver in Yellowknife at sunset"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/90 via-background/70 to-background" />
      </div>

      <div className="relative mx-auto max-w-7xl px-5 lg:px-8 py-20 md:py-28 lg:py-36">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-2xl space-y-6"
        >
          <span className="inline-block rounded-full bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-primary ring-1 ring-primary/20">
            Drive with PickYou
          </span>
          <h1 className="text-4xl font-black leading-[1.05] tracking-tight md:text-6xl lg:text-7xl">
            Drive in Yellowknife.
            <br />
            <span className="text-primary">Earn on your schedule.</span>
          </h1>
          <p className="text-base leading-relaxed text-muted-foreground md:text-lg max-w-xl">
            Set your own hours. Keep up to 95.1% of every fare. Get approved in as little as 24 hours and start earning this week.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center pt-2">
            <Button
              size="lg"
              className="h-14 rounded-xl text-sm font-bold sm:px-8"
              onClick={() => navigate("/login?role=driver")}
            >
              Apply in 4 minutes
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <a
              href="#how-it-works"
              className="inline-flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-semibold text-foreground/80 hover:text-foreground transition-colors"
            >
              How it works
              <ChevronDown className="h-4 w-4" />
            </a>
          </div>

          {/* Trust strip */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-3 text-[12px] font-medium text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              No fees
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Keep 95.1%
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Approved in 24 hrs
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default DriveHero;
