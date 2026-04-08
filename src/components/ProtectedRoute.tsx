import { useAuth } from "@/hooks/useAuth";
import { Navigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ProtectedRouteProps {
  allowedRoles: string[];
  children: React.ReactNode;
}

const REQUIRED_DOC_TYPES = ["drivers_license", "vehicle_insurance", "vehicle_registration"];

const ProtectedRoute = ({ allowedRoles, children }: ProtectedRouteProps) => {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  // Check driver onboarding status
  const { data: verifications, isLoading: verificationsLoading } = useQuery({
    queryKey: ["driver-verifications", profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("verifications")
        .select("document_type, status")
        .eq("driver_id", profile!.id);
      return data || [];
    },
    enabled: !!profile && profile.role === "driver",
  });

  if (loading || (profile?.role === "driver" && verificationsLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse-glow w-8 h-8 rounded-full bg-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  const role = profile?.role || "rider";

  if (!allowedRoles.includes(role)) {
    const roleRoute = role === "admin" ? "/admin" : role === "driver" ? "/driver" : "/rider";
    return <Navigate to={roleRoute} replace />;
  }

  // Driver onboarding gate
  if (role === "driver" && !location.pathname.startsWith("/driver/onboarding")) {
    const hasVehicle = !!profile?.vehicle_type;
    const hasAllDocs = REQUIRED_DOC_TYPES.every((docType) =>
      verifications?.some((v) => v.document_type === docType)
    );
    const allApproved = REQUIRED_DOC_TYPES.every((docType) =>
      verifications?.some((v) => v.document_type === docType && v.status === "approved")
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
