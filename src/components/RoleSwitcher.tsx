import { useNavigate } from "react-router-dom";
import { Car, User } from "lucide-react";
import { toast } from "sonner";
import { useActiveRole } from "@/contexts/ActiveRoleContext";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

/**
 * Header role badge + switcher.
 *
 * - Users with both roles see a two-segment toggle (Rider | Driver).
 * - Users with only one role see a static "mode" pill so they always know
 *   which dashboard they are in (the #1 source of "stuck in wrong app"
 *   confusion was the lack of a visible mode label).
 * - Riders who have not opted into driving see a compact "Become a driver"
 *   link that routes them straight into onboarding.
 */
const RoleSwitcher = () => {
  const { activeRole, setActiveRole, canSwitch } = useActiveRole();
  const { profile } = useAuth();
  const navigate = useNavigate();

  const isAdmin = profile?.role === "admin";
  if (isAdmin) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
        Admin mode
      </span>
    );
  }

  // Rider-only user (no driver capability yet) — show a static badge plus a
  // discreet "Become a driver" upgrade link so they know how to opt in.
  if (!canSwitch) {
    const showUpgrade = !!profile?.is_rider && !profile?.is_driver;
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-2.5 py-1 text-xs font-semibold text-muted-foreground">
          <User className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Rider mode</span>
          <span className="sm:hidden">Rider</span>
        </span>
        {showUpgrade && (
          <button
            type="button"
            onClick={() => navigate("/driver/onboarding")}
            className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            <Car className="h-3.5 w-3.5" />
            Become a driver
          </button>
        )}
      </div>
    );
  }

  const handleSwitch = (role: "rider" | "driver") => {
    if (role === activeRole) return;
    setActiveRole(role);
    navigate(role === "driver" ? "/driver" : "/rider");
    toast.success(role === "driver" ? "Switched to Driver mode" : "Switched to Rider mode");
  };

  return (
    <div
      role="group"
      aria-label="Switch between Rider and Driver mode"
      className="inline-flex items-center rounded-full border border-border/60 bg-muted/40 p-0.5"
    >
      <button
        type="button"
        onClick={() => handleSwitch("rider")}
        aria-pressed={activeRole === "rider"}
        className={cn(
          "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors",
          activeRole === "rider"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <User className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Rider</span>
      </button>
      <button
        type="button"
        onClick={() => handleSwitch("driver")}
        aria-pressed={activeRole === "driver"}
        className={cn(
          "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors",
          activeRole === "driver"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Car className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Driver</span>
      </button>
    </div>
  );
};

export default RoleSwitcher;
