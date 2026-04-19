import { useNavigate } from "react-router-dom";
import { Briefcase, Car, User } from "lucide-react";
import { toast } from "sonner";
import { useActiveRole, type ActiveRole } from "@/contexts/ActiveRoleContext";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

/**
 * Header role badge + switcher (Rider / Driver / Business).
 *
 * - Admins see a static "Admin mode" badge.
 * - Users with multiple capabilities see a segmented toggle of held caps.
 * - Users with a single capability see a static badge.
 * - Riders without driver capability see a discreet "Become a driver" link.
 */
const RoleSwitcher = () => {
  const { activeRole, setActiveRole, canSwitch, capabilities } = useActiveRole();
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

  const heldRoles: Array<"rider" | "driver" | "business"> = (
    ["rider", "driver", "business"] as const
  ).filter((r) => capabilities[r]);

  // Single-cap user — show static badge + optional upgrade prompts
  if (!canSwitch) {
    const showDriverUpgrade = capabilities.rider && !capabilities.driver;
    const showBusinessUpgrade = capabilities.rider && !capabilities.business;
    const role = heldRoles[0] || "rider";
    const meta = roleMeta(role);
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-2.5 py-1 text-xs font-semibold text-muted-foreground">
          {meta.icon}
          <span className="hidden sm:inline">{meta.label} mode</span>
          <span className="sm:hidden">{meta.label}</span>
        </span>
        {showDriverUpgrade && (
          <button
            type="button"
            onClick={() => navigate("/signup/driver")}
            aria-label="Become a driver"
            className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
          >
            <Car className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Become a driver</span>
            <span className="sm:hidden">Drive</span>
          </button>
        )}
        {showBusinessUpgrade && (
          <button
            type="button"
            onClick={() => navigate("/business/apply")}
            aria-label="Apply for business account"
            className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
          >
            <Briefcase className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">For business</span>
            <span className="sm:hidden">Business</span>
          </button>
        )}
      </div>
    );
  }

  const handleSwitch = (role: "rider" | "driver" | "business") => {
    if (role === activeRole) return;
    setActiveRole(role as ActiveRole);
    if (role === "driver") navigate("/driver");
    else if (role === "business") navigate("/business");
    else navigate("/rider");
    toast.success(`Switched to ${roleMeta(role).label} mode`);
  };

  return (
    <div
      role="group"
      aria-label="Switch between Rider, Driver and Business mode"
      className="inline-flex items-center rounded-full border border-border/60 bg-muted/40 p-0.5"
    >
      {heldRoles.map((r) => {
        const meta = roleMeta(r);
        const active = activeRole === r;
        return (
          <button
            key={r}
            type="button"
            onClick={() => handleSwitch(r)}
            aria-pressed={active}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {meta.icon}
            <span className="hidden sm:inline">{meta.label}</span>
          </button>
        );
      })}
    </div>
  );
};

function roleMeta(role: "rider" | "driver" | "business") {
  if (role === "driver") return { label: "Driver", icon: <Car className="h-3.5 w-3.5" /> };
  if (role === "business") return { label: "Business", icon: <Briefcase className="h-3.5 w-3.5" /> };
  return { label: "Rider", icon: <User className="h-3.5 w-3.5" /> };
}

export default RoleSwitcher;
