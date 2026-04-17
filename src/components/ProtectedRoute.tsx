import { useAuth } from "@/hooks/useAuth";
import { Navigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveRole } from "@/contexts/ActiveRoleContext";

interface ProtectedRouteProps {
  allowedRoles: string[];
  children: React.ReactNode;
}

const REQUIRED_DOC_TYPES = ["drivers_license", "vehicle_insurance", "vehicle_registration"];

const ProtectedRoute = ({ allowedRoles, children }: ProtectedRouteProps) => {
  const { user, profile, loading } = useAuth();
  const location = useLocation();
  const { activeRole } = useActiveRole();

  const isDriverRoute = location.pathname.startsWith("/driver");
  const needsVerifications = !!profile && (profile.is_driver || profile.role === "driver");

  // Check driver onboarding status (only when relevant)
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

  // Capability-based access — a user with is_driver can hit /driver routes
  // even if their primary `role` is still 'rider'. Admin is exclusive.
  const dbRole = profile?.role || "rider";
  const isAdmin = dbRole === "admin";
  const hasDriverAccess = isAdmin || !!profile?.is_driver;
  const hasRiderAccess = isAdmin || !!profile?.is_rider || dbRole === "rider" || dbRole === "driver";

  const canAccess =
    (allowedRoles.includes("admin") && isAdmin) ||
    (allowedRoles.includes("driver") && hasDriverAccess) ||
    (allowedRoles.includes("rider") && hasRiderAccess);

  if (!canAccess) {
    const roleRoute = isAdmin ? "/admin" : profile?.is_driver ? "/driver" : "/rider";
    return <Navigate to={roleRoute} replace />;
  }

  // Driver onboarding gate — applies only to driver routes (excluding the
  // onboarding pages themselves) when the user holds driver capability.
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
