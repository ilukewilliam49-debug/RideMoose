import { useTranslation } from "react-i18next";
import { Plus, X, GripVertical } from "lucide-react";
import AddressAutocomplete from "@/components/map/AddressAutocomplete";
import { MAX_INTERMEDIATE_STOPS, type RideStop } from "@/types/stops";
import { cn } from "@/lib/utils";

interface RouteStopsEditorProps {
  stops: RideStop[];
  onChange: (stops: RideStop[]) => void;
  /** Optional className for the container */
  className?: string;
}

/**
 * Compact editor for intermediate stops between pickup and dropoff.
 * - Up to 3 stops
 * - Add / remove / reorder
 * - Each stop is geocoded via AddressAutocomplete
 *
 * Renders nothing visible if no stops have been added yet — the parent
 * component is responsible for rendering an "Add stop" affordance through
 * the `onChange` callback (or by reading the `canAddStop` helper).
 */
export default function RouteStopsEditor({ stops, onChange, className }: RouteStopsEditorProps) {
  const { t } = useTranslation();
  const canAdd = stops.length < MAX_INTERMEDIATE_STOPS;

  const updateStop = (idx: number, patch: Partial<RideStop>) => {
    const next = stops.map((s, i) => (i === idx ? { ...s, ...patch } : s));
    onChange(next);
  };

  const removeStop = (idx: number) => {
    onChange(stops.filter((_, i) => i !== idx));
  };

  const moveStop = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= stops.length) return;
    const next = [...stops];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  const addStop = () => {
    if (!canAdd) return;
    onChange([...stops, { address: "", lat: 0, lng: 0 }]);
  };

  return (
    <div className={cn("space-y-2", className)}>
      {stops.map((stop, idx) => (
        <div
          key={idx}
          className="flex items-center gap-2 rounded-xl border border-border/60 bg-card p-2"
        >
          <div className="flex flex-col items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={() => moveStop(idx, -1)}
              disabled={idx === 0}
              className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-accent disabled:opacity-30 disabled:hover:bg-transparent"
              aria-label={t("rider.moveUp", "Move up")}
            >
              <GripVertical className="h-3 w-3 rotate-90" />
            </button>
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
              {idx + 1}
            </span>
          </div>

          <div className="flex-1 [&_svg.absolute]:hidden [&_input]:border-0 [&_input]:bg-transparent [&_input]:shadow-none [&_input]:focus-visible:ring-0 [&_input]:focus-visible:ring-offset-0 [&_input]:text-[14px] [&_input]:font-medium [&_input]:placeholder:text-muted-foreground [&_input]:h-9 [&_input]:px-0 [&_input]:pl-0">
            <AddressAutocomplete
              value={stop.address}
              onChange={(value, lat, lng) => {
                if (typeof lat === "number" && typeof lng === "number") {
                  updateStop(idx, { address: value, lat, lng });
                } else {
                  updateStop(idx, { address: value });
                }
              }}
              placeholder={t("rider.stopPlaceholder", "Add stop {{n}}", { n: idx + 1 })}
              iconColor="text-amber-500"
            />
          </div>

          <button
            type="button"
            onClick={() => removeStop(idx)}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
            aria-label={t("rider.removeStop", "Remove stop")}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}

      {canAdd && (
        <button
          type="button"
          onClick={addStop}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border/60 bg-secondary/30 px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          {stops.length === 0
            ? t("rider.addStop", "Add a stop")
            : t("rider.addAnotherStop", "Add another stop ({{remaining}} left)", {
                remaining: MAX_INTERMEDIATE_STOPS - stops.length,
              })}
        </button>
      )}
    </div>
  );
}
