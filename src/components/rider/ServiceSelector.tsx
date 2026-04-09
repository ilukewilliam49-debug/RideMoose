import { Car, Package, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { ServiceType } from "@/hooks/useRideBookingState";

interface ServiceSelectorProps {
  selected: ServiceType;
  onSelect: (s: ServiceType) => void;
  prices: {
    taxi: string | null;
    private_hire: string | null;
    courier: string | null;
  };
  etaText?: string | null;
  driverETAs?: {
    taxi: string | null;
    private_hire: string | null;
    courier: string | null;
  };
}

const PickYouIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 13h1l1.5-4.5A1 1 0 0 1 6.45 8h11.1a1 1 0 0 1 .95.68L20 13h1a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-1.05a2.5 2.5 0 0 1-4.9 0h-6.1a2.5 2.5 0 0 1-4.9 0H3a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1z" />
    <path d="M6 13V9.5" />
    <path d="M18 13V9.5" />
    <path d="M9 8V6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    <circle cx="7" cy="17" r="1.5" />
    <circle cx="17" cy="17" r="1.5" />
  </svg>
);

const services: { key: ServiceType; labelKey: string; desc: string; icon: React.ReactNode }[] = [
  {
    key: "taxi",
    labelKey: "dashboard.taxi",
    desc: "Metered ride",
    icon: <Car className="h-5 w-5" />,
  },
  {
    key: "private_hire",
    labelKey: "dashboard.charter",
    desc: "Premium pre-booked",
    icon: <PickYouIcon className="h-5 w-5" />,
  },
  {
    key: "courier",
    labelKey: "dashboard.delivery",
    desc: "Send a parcel",
    icon: <Package className="h-5 w-5" />,
  },
];

const ServiceSelector = ({ selected, onSelect, prices, etaText, driverETAs }: ServiceSelectorProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {t("rider.chooseService", "Choose a service")}
      </p>
      <div className="space-y-2">
        {services.map((svc) => {
          const isActive = selected === svc.key;
          const price = prices[svc.key as keyof typeof prices];
          return (
            <button
              key={svc.key}
              type="button"
              onClick={() => {
                if (svc.key === "courier") {
                  const params = new URLSearchParams(searchParams);
                  params.set("service", "courier");
                  navigate(`/rider/courier?${params.toString()}`);
                  return;
                }
                onSelect(svc.key);
              }}
              className={cn(
                "w-full flex items-center gap-3 rounded-xl p-3 border-2 transition-all duration-200 text-left",
                isActive
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-transparent bg-card hover:bg-accent/50"
              )}
            >
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors",
                  isActive ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                )}
              >
                {svc.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold">{t(svc.labelKey, svc.key)}</span>
                  {(() => {
                    const driverEta = driverETAs?.[svc.key as keyof typeof driverETAs];
                    return driverEta ? (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-green-500/10 px-1.5 py-0.5 text-[10px] font-medium text-green-600">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                        {driverEta}
                      </span>
                    ) : etaText && svc.key !== "courier" ? (
                      <span className="text-[10px] text-muted-foreground">{etaText}</span>
                    ) : null;
                  })()}
                </div>
                <p className="text-[11px] text-muted-foreground">{svc.desc}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {price ? (
                  <span className={cn("text-base font-mono font-bold", isActive ? "text-primary" : "text-foreground")}>
                    ${price}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
                {isActive && (
                  <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                    <Check className="h-3 w-3 text-primary-foreground" />
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ServiceSelector;
