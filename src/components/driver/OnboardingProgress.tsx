import { Check } from "lucide-react";

interface Step {
  key: string;
  label: string;
}

interface OnboardingProgressProps {
  steps: Step[];
  currentIndex: number;
  onStepClick?: (index: number) => void;
}

/**
 * Labelled top progress bar with circles + connecting lines.
 * Filled = done, ring = current, hollow = upcoming.
 * Tapping a completed step navigates back to it.
 */
export const OnboardingProgress = ({
  steps,
  currentIndex,
  onStepClick,
}: OnboardingProgressProps) => {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between gap-1">
        {steps.map((step, idx) => {
          const done = idx < currentIndex;
          const active = idx === currentIndex;
          const clickable = done && onStepClick;
          const isLast = idx === steps.length - 1;

          return (
            <div key={step.key} className="flex items-center flex-1 last:flex-none">
              <button
                type="button"
                onClick={() => clickable && onStepClick(idx)}
                disabled={!clickable}
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-all ${
                  done
                    ? "bg-primary text-primary-foreground hover:scale-105 cursor-pointer"
                    : active
                      ? "bg-primary/15 text-primary ring-2 ring-primary"
                      : "bg-secondary text-muted-foreground ring-1 ring-border"
                } ${clickable ? "" : "cursor-default"}`}
                aria-label={`Step ${idx + 1}: ${step.label}${done ? " (completed)" : active ? " (current)" : ""}`}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : idx + 1}
              </button>
              {!isLast && (
                <div
                  className={`h-0.5 flex-1 mx-1.5 rounded-full transition-colors ${
                    done ? "bg-primary" : "bg-border"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px] font-medium uppercase tracking-wider">
        {steps.map((step, idx) => {
          const active = idx === currentIndex;
          const done = idx < currentIndex;
          return (
            <span
              key={step.key}
              className={`${
                active
                  ? "text-foreground"
                  : done
                    ? "text-primary/70"
                    : "text-muted-foreground/60"
              }`}
              style={{ flex: idx === steps.length - 1 ? "none" : 1 }}
            >
              {step.label}
            </span>
          );
        })}
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        Step {currentIndex + 1} of {steps.length} ·{" "}
        <span className="text-foreground font-medium">{steps[currentIndex]?.label}</span>
      </p>
    </div>
  );
};

export default OnboardingProgress;
