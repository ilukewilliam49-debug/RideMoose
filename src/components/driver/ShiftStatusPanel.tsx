import { motion } from "framer-motion";
import { Clock3, ShieldCheck, AlertTriangle, Coffee, Power } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface ShiftStatusPanelProps {
  isOnline: boolean;
  /** Total shift duration in milliseconds (0 if offline / no shift). */
  elapsedMs: number;
  /** Regulatory cap, in milliseconds (12h = 43,200,000). */
  limitMs: number;
  /** Driver has hit the cap and was forced offline this session. */
  capped: boolean;
  /** True while the toggle request is in flight. */
  toggling: boolean;
  onGoOffline: () => void;
}

/**
 * Driver-facing shift status panel.
 *
 * Surfaces the regulatory 12-hour Hours-of-Service cap so the driver always
 * knows where they stand. States rendered:
 *  • Offline             — neutral, ready to start a shift.
 *  • Online (safe)       — green, time-elapsed + time-remaining.
 *  • Online (warning)    — amber, < 1 hour remaining.
 *  • Online (critical)   — red, < 15 min remaining.
 *  • Capped              — blocked, must rest before going online again.
 */
const ShiftStatusPanel = ({
  isOnline,
  elapsedMs,
  limitMs,
  capped,
  toggling,
  onGoOffline,
}: ShiftStatusPanelProps) => {
  const remainingMs = Math.max(0, limitMs - elapsedMs);
  const pct = Math.min(100, Math.round((elapsedMs / limitMs) * 100));

  const fmtHM = (ms: number) => {
    const total = Math.max(0, Math.floor(ms / 60000));
    const h = Math.floor(total / 60);
    const m = total % 60;
    if (h <= 0) return `${m}m`;
    return `${h}h ${m.toString().padStart(2, "0")}m`;
  };

  // ─── Capped state — blocking guidance ───
  if (capped) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl bg-destructive/10 ring-1 ring-destructive/30 p-4 space-y-3"
        role="alert"
        aria-live="assertive"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-destructive/15 text-destructive">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-widest text-destructive">
              12-hour limit reached
            </p>
            <h3 className="text-base font-semibold leading-tight mt-0.5">
              You've been taken offline
            </h3>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              City regulations require a rest break before you can accept new trips.
              Your shift has been closed and your earnings are saved.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-background/60 px-3 py-2 text-xs text-muted-foreground">
          <Coffee className="h-3.5 w-3.5 shrink-0" />
          <span>Take a break, then return when you're ready to start a fresh shift.</span>
        </div>
      </motion.div>
    );
  }

  // ─── Offline state — neutral ───
  if (!isOnline) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between rounded-2xl bg-muted/50 ring-1 ring-border/50 px-4 py-3"
      >
        <div className="flex items-center gap-3">
          <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground" />
          <span className="text-sm font-semibold">Offline</span>
        </div>
        <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
          <ShieldCheck className="h-3 w-3" />
          12h shift cap
        </span>
      </motion.div>
    );
  }

  // ─── Online — color tier based on remaining time ───
  const critical = remainingMs <= 15 * 60 * 1000;
  const warning = !critical && remainingMs <= 60 * 60 * 1000;

  const tierRing = critical
    ? "ring-destructive/30 bg-destructive/10"
    : warning
    ? "ring-amber-500/30 bg-amber-500/10"
    : "ring-green-500/20 bg-green-500/10";

  const tierText = critical
    ? "text-destructive"
    : warning
    ? "text-amber-600 dark:text-amber-500"
    : "text-green-600 dark:text-green-500";

  const tierDot = critical
    ? "bg-destructive"
    : warning
    ? "bg-amber-500"
    : "bg-green-500";

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl p-4 space-y-3 ring-1 ${tierRing}`}
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full animate-pulse ${tierDot}`} />
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight">
              Online — accepting trips
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Shift {fmtHM(elapsedMs)} of 12h
            </p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className={`text-[10px] font-bold uppercase tracking-widest ${tierText}`}>
            {critical ? "Ending soon" : warning ? "Time low" : "Time left"}
          </p>
          <p className={`text-base font-bold leading-none mt-1 tabular-nums ${tierText}`}>
            {fmtHM(remainingMs)}
          </p>
        </div>
      </div>

      {/* Progress to cap */}
      <div className="space-y-1.5">
        <Progress
          value={pct}
          className={`h-1.5 ${
            critical
              ? "[&>div]:bg-destructive"
              : warning
              ? "[&>div]:bg-amber-500"
              : "[&>div]:bg-green-500"
          }`}
        />
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock3 className="h-2.5 w-2.5" />
            Hours-of-Service cap
          </span>
          <span className="font-semibold tabular-nums">{pct}%</span>
        </div>
      </div>

      {/* Action — only shown in warning/critical so it doesn't clutter the safe state */}
      {(warning || critical) && (
        <button
          onClick={onGoOffline}
          disabled={toggling}
          className={`
            flex w-full items-center justify-center gap-2 rounded-xl
            px-3 py-2.5 text-xs font-semibold transition active:scale-[0.98]
            disabled:opacity-50 disabled:active:scale-100
            ${critical
              ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
              : "bg-amber-500 text-white hover:bg-amber-500/90"
            }
          `}
        >
          <Power className="h-3.5 w-3.5" />
          {critical ? "End shift now" : "Plan to wrap up"}
        </button>
      )}
    </motion.div>
  );
};

export default ShiftStatusPanel;
