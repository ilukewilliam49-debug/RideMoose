import { useNavigate } from "react-router-dom";
import { Briefcase, Car, ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

/**
 * Discovery card shown on the rider dashboard for users who only hold the
 * rider capability. Promotes the driver and business onboarding flows so
 * users can find them without leaving the app.
 *
 * Hidden when:
 *  - profile not loaded
 *  - user is admin
 *  - user already holds either driver OR business capability
 */
const RoleUpgradeChips = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();

  if (!profile) return null;
  if (profile.role === "admin") return null;
  // Already a driver or business — no upgrade needed
  if (profile.is_driver || profile.is_business) return null;

  return (
    <div className="rounded-xl border border-border/60 bg-card/50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Do more with PickYou</h2>
          <p className="text-xs text-muted-foreground">
            Add another role to your account anytime.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => navigate("/signup/driver")}
          className="group flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5 text-left transition-colors hover:bg-primary/10"
          aria-label="Become a driver"
        >
          <span className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Car className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-foreground">
                Become a driver
              </span>
              <span className="block text-xs text-muted-foreground">
                Earn on your schedule
              </span>
            </span>
          </span>
          <ArrowRight className="h-4 w-4 text-primary transition-transform group-hover:translate-x-0.5" />
        </button>

        <button
          type="button"
          onClick={() => navigate("/business/apply")}
          className="group flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5 text-left transition-colors hover:bg-primary/10"
          aria-label="Apply for a business account"
        >
          <span className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Briefcase className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-foreground">
                Apply for business
              </span>
              <span className="block text-xs text-muted-foreground">
                Monthly invoicing for teams
              </span>
            </span>
          </span>
          <ArrowRight className="h-4 w-4 text-primary transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    </div>
  );
};

export default RoleUpgradeChips;
