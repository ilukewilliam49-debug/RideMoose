import { Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

interface PassengerCountPickerProps {
  value: number;
  onChange: (n: number) => void;
  max?: number;
}

const PassengerCountPicker = ({ value, onChange, max = 6 }: PassengerCountPickerProps) => {
  const { t } = useTranslation();
  const counts = Array.from({ length: max }, (_, i) => i + 1);
  const showsSurcharge = value >= 5;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" />
          {t("rider.passengers", "Passengers")}
        </p>
        {showsSurcharge && (
          <span className="text-[10px] font-medium text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full">
            +$6.00 {t("rider.largeGroupFee", "large group fee")}
          </span>
        )}
      </div>
      <div className="grid grid-cols-6 gap-1.5">
        {counts.map((n) => {
          const isActive = value === n;
          const isLarge = n >= 5;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className={cn(
                "h-10 rounded-lg border-2 text-sm font-bold transition-all duration-150",
                isActive
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-transparent bg-secondary text-foreground hover:bg-accent",
                isLarge && !isActive && "ring-1 ring-amber-500/30"
              )}
              aria-label={`${n} ${n === 1 ? "passenger" : "passengers"}`}
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default PassengerCountPicker;
