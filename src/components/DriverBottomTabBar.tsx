import { Home, Radio, DollarSign, User } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const tabs = [
  { icon: Home, label: "Home", path: "/driver" },
  { icon: Radio, label: "Dispatch", path: "/driver/dispatch" },
  { icon: DollarSign, label: "Earnings", path: "/driver/earnings" },
  { icon: User, label: "Account", path: "/driver/account" },
];

const DriverBottomTabBar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useAuth();

  // Pending request count for dispatch badge
  const { data: pendingCount } = useQuery({
    queryKey: ["dispatch-pending-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("rides")
        .select("id", { count: "exact", head: true })
        .in("status", ["requested", "dispatched"]);
      if (error) return 0;
      return count || 0;
    },
    enabled: !!profile?.id,
    refetchInterval: 10000,
  });

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/40 bg-background/95 backdrop-blur-xl md:hidden">
      <div className="flex h-16 items-stretch">
        {tabs.map((tab) => {
          const isActive =
            tab.path === "/driver"
              ? location.pathname === "/driver"
              : location.pathname.startsWith(tab.path);

          const showBadge = tab.path === "/driver/dispatch" && (pendingCount ?? 0) > 0;

          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors ${
                isActive ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              <div className="relative">
                <tab.icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 2} />
                {showBadge && (
                  <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                    {pendingCount! > 9 ? "9+" : pendingCount}
                  </span>
                )}
              </div>
              <span className={`text-[10px] ${isActive ? "font-bold" : "font-medium"}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
};

export default DriverBottomTabBar;
