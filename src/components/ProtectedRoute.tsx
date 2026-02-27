import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";

interface ProtectedRouteProps {
  allowedRoles: string[];
  children: React.ReactNode;
}

const ProtectedRoute = ({ allowedRoles, children }: ProtectedRouteProps) => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse-glow w-8 h-8 rounded-full bg-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  const role = profile?.role || "rider";

  if (!allowedRoles.includes(role)) {
    // Redirect to the correct dashboard for their role
    const roleRoute = role === "admin" ? "/admin" : role === "driver" ? "/driver" : "/rider";
    return <Navigate to={roleRoute} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
