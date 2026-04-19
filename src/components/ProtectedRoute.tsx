import { useAuth } from "@/hooks/useAuth";
import { Navigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveRole } from "@/contexts/ActiveRoleContext";

interface ProtectedRouteProps {
  allowedRoles: Array<"rider" | "driver" | "business" | "admin">;
  children: React.ReactNode;
}

const REQUIRED_DOC_TYPES = ["drivers_license", "vehicle_insurance", "vehicle_registration"];

/**
 * Capability-based route guard.
 *
 * Onboarding gates are FLOW-SCOPED — driver onboarding only blocks /driver/*,
 * never /rider/*, /business/*, or /admin/*. This prevents a dual-capability
 * user from being trapped in driver onboarding when trying to use other flows.
 */
const ProtectedRoute = ({ allowedRoles, children }: ProtectedRouteProps) => {
  const { user, profile, isAdmin, loading } = useAuth();
  const location = useLocation();
  const { activeRole, defaultRole } = useActiveRole();

  const isDriverRoute = location.pathname.startsWith("/driver");
  // Only run the verifications query when the user is on a driver route AND
  // has driver capability — avoids unnecessary fetches on rider/business pages.
  const needsVerifications = isDriverRoute && !!profile?.is_driver;

  const { data: verifications, isLoading: verificationsLoading } = useQuery({
    queryKey: ["driver-verifications", profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("verifications")
        .select("document_type, status")
        .eq("driver_id", profile!.id);
      return data || [];
    },
    enabled: needsVerifications,
  });

  if (loading || (needsVerifications && verificationsLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse-glow w-8 h-8 rounded-full bg-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // Capability checks. Admin is exclusive.
  const hasRiderAccess = isAdmin || !!profile?.is_rider;
  const hasDriverAccess = isAdmin || !!profile?.is_driver;
  const hasBusinessAccess = isAdmin || !!profile?.is_business;

  const canAccess =
    (allowedRoles.includes("admin") && isAdmin) ||
    (allowedRoles.includes("driver") && hasDriverAccess) ||
    (allowedRoles.includes("rider") && hasRiderAccess) ||
    (allowedRoles.includes("business") && hasBusinessAccess);

  if (!canAccess) {
    const fallback = isAdmin
      ? "/admin"
      : profile?.is_rider
      ? "/rider"
      : profile?.is_driver
      ? "/driver"
      : profile?.is_business
      ? "/business/apply"
      : "/rider";
    return <Navigate to={fallback} replace />;
  }

  // Driver-onboarding gate — ONLY fires on /driver/* routes (excluding the
  // onboarding pages themselves) and only when the user is in driver mode.
  // Never blocks /rider, /business, or /admin even if driver onboarding is
  // incomplete.
  if (
    isDriverRoute &&
    !location.pathname.startsWith("/driver/onboarding") &&
    profile?.is_driver
  ) {
    const hasVehicle = !!profile?.vehicle_type;
    const hasAllDocs = REQUIRED_DOC_TYPES.every((docType) =>
      verifications?.some((v) => v.document_type === docType),
    );
    const allApproved = REQUIRED_DOC_TYPES.every((docType) =>
      verifications?.some((v) => v.document_type === docType && v.status === "approved"),
    );

    if (!hasVehicle || !hasAllDocs) {
      return <Navigate to="/driver/onboarding" replace />;
    }
    if (!allApproved) {
      return <Navigate to="/driver/onboarding/pending" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
