import { useNavigate } from "react-router-dom";
import { Car, User } from "lucide-react";
import { toast } from "sonner";
import { useActiveRole } from "@/contexts/ActiveRoleContext";
import { cn } from "@/lib/utils";

const RoleSwitcher = () => {
  const { activeRole, setActiveRole, canSwitch } = useActiveRole();
  const navigate = useNavigate();

  if (!canSwitch) return null;

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
