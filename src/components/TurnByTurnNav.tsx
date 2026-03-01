import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Navigation,
  ArrowUp,
  CornerUpLeft,
  CornerUpRight,
  RotateCcw,
  Merge,
  GitFork,
  ChevronDown,
  ChevronUp,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export interface NavStep {
  instruction: string;
  distance_text: string;
  distance_m: number;
  duration_text: string;
  duration_sec: number;
  maneuver: string | null;
  start_lat: number;
  start_lng: number;
  end_lat: number;
  end_lng: number;
}

interface TurnByTurnNavProps {
  steps: NavStep[];
  driverLat?: number | null;
  driverLng?: number | null;
}

const maneuverIcon = (maneuver: string | null) => {
  if (!maneuver) return <ArrowUp className="h-5 w-5" />;
  if (maneuver.includes("left") && maneuver.includes("u-turn")) return <RotateCcw className="h-5 w-5" />;
  if (maneuver.includes("left")) return <CornerUpLeft className="h-5 w-5" />;
  if (maneuver.includes("right")) return <CornerUpRight className="h-5 w-5" />;
  if (maneuver.includes("merge")) return <Merge className="h-5 w-5" />;
  if (maneuver.includes("fork")) return <GitFork className="h-5 w-5" />;
  if (maneuver.includes("straight")) return <ArrowUp className="h-5 w-5" />;
  return <Navigation className="h-5 w-5" />;
};

const stripHtml = (html: string) => html.replace(/<[^>]*>/g, "");

const distanceTo = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const TurnByTurnNav = ({ steps, driverLat, driverLng }: TurnByTurnNavProps) => {
  const [expanded, setExpanded] = useState(false);

  // Find the closest upcoming step based on driver position
  const currentStepIndex = useMemo(() => {
    if (!driverLat || !driverLng || !steps.length) return 0;
    let closestIdx = 0;
    let closestDist = Infinity;
    for (let i = 0; i < steps.length; i++) {
      const d = distanceTo(driverLat, driverLng, steps[i].start_lat, steps[i].start_lng);
      // Prefer steps ahead (end_location closer means we haven't passed it)
      const dEnd = distanceTo(driverLat, driverLng, steps[i].end_lat, steps[i].end_lng);
      // Use combined proximity: if we're close to end, we've passed it
      if (d < closestDist && dEnd > 30) {
        closestDist = d;
        closestIdx = i;
      }
    }
    return closestIdx;
  }, [steps, driverLat, driverLng]);

  if (!steps.length) return null;

  const currentStep = steps[currentStepIndex];
  const nextStep = steps[currentStepIndex + 1];
  const remainingSteps = steps.slice(currentStepIndex);

  return (
    <div className="glass-surface rounded-lg border border-border overflow-hidden">
      {/* Current step - hero */}
      <div className="bg-primary/10 p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary">
            {maneuverIcon(currentStep.maneuver)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground leading-snug">
              {stripHtml(currentStep.instruction)}
            </p>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs text-muted-foreground font-mono">{currentStep.distance_text}</span>
              <span className="text-xs text-muted-foreground font-mono">{currentStep.duration_text}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Next step preview */}
      {nextStep && (
        <div className="px-4 py-2.5 border-t border-border/50 flex items-center gap-3">
          <div className="flex-shrink-0 w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-muted-foreground">
            {maneuverIcon(nextStep.maneuver)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground truncate">{stripHtml(nextStep.instruction)}</p>
            <span className="text-[10px] text-muted-foreground/70 font-mono">{nextStep.distance_text}</span>
          </div>
          <span className="text-[10px] text-muted-foreground font-mono whitespace-nowrap">Then</span>
        </div>
      )}

      {/* Expand/collapse remaining steps */}
      {remainingSteps.length > 2 && (
        <>
          <Button
            variant="ghost"
            size="sm"
            className="w-full rounded-none border-t border-border/50 text-xs text-muted-foreground gap-1"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expanded ? "Hide" : `Show all ${remainingSteps.length} steps`}
          </Button>

          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="max-h-60 overflow-y-auto divide-y divide-border/30">
                  {remainingSteps.slice(2).map((step, i) => (
                    <div key={i} className="px-4 py-2 flex items-center gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-secondary/50 flex items-center justify-center text-muted-foreground">
                        {maneuverIcon(step.maneuver)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-foreground/80 truncate">{stripHtml(step.instruction)}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground font-mono whitespace-nowrap">{step.distance_text}</span>
                    </div>
                  ))}
                  {/* Destination marker */}
                  <div className="px-4 py-2 flex items-center gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                      <MapPin className="h-3.5 w-3.5" />
                    </div>
                    <p className="text-xs font-medium text-primary">Arrive at destination</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
};

export default TurnByTurnNav;
