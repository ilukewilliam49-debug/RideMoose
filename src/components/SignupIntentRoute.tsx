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

  // Preserve the intent across the entire signup journey, including for
  // business — /business/apply checks the intent param to know which flow
  // brought the user in, and login round-trips need it too.
  const returnTo =
    existingReturn ||
    (role === "driver" ? "/driver" : role === "business" ? "/business/apply" : "/rider");
  const params = new URLSearchParams({ intent: role, returnTo });

  if (role === "business") {
    // Business apply page handles its own auth state + returnTo, so go
    // straight there with the intent preserved.
    return <Navigate to={`/business/apply?${params.toString()}`} replace />;
  }

  return <Navigate to={`/login?${params.toString()}`} replace />;
};

export default SignupIntentRoute;
