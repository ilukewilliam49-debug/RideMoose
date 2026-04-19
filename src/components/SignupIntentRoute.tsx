import { Navigate, useSearchParams } from "react-router-dom";

/**
 * Signup intent shim: routes like /signup/driver, /signup/rider,
 * /signup/business redirect to the login page (or business apply form for
 * business intent) carrying the intent + a sane returnTo. AuthCallback /
 * useAuth then provision the matching capability after sign-in.
 */
const SignupIntentRoute = ({ role }: { role: "rider" | "driver" | "business" }) => {
  const [search] = useSearchParams();
  const existingReturn = search.get("returnTo");

  if (role === "business") {
    // Business apply page handles its own auth state + returnTo, so go
    // straight there. The page will prompt sign-in if needed.
    return <Navigate to="/business/apply" replace />;
  }

  const returnTo = existingReturn || (role === "driver" ? "/driver" : "/rider");
  const params = new URLSearchParams({ intent: role, returnTo });
  return <Navigate to={`/login?${params.toString()}`} replace />;
};

export default SignupIntentRoute;
