import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  resolvePostAuthRoute,
  clearRoleIntentFromUrl,
  provisionCapabilityFromIntent,
} from "@/lib/post-auth-route";

const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error || !session) {
          console.error("OAuth callback error:", error?.message);
          navigate("/login", { replace: true });
          return;
        }

        const params = new URLSearchParams(window.location.search);
        const intent = params.get("intent");
        const returnTo = params.get("returnTo");

        // Provision the matching capability via the shared helper. Admin
        // status lives in user_roles and is unaffected by capability flags.
        await provisionCapabilityFromIntent(session.user.id, intent);

        const [{ data: profile }, { data: roles }] = await Promise.all([
          supabase
            .from("profiles")
            .select("is_driver, is_rider, is_business, driver_onboarding_complete, business_onboarding_complete, rider_onboarding_complete, last_used_role")
            .eq("user_id", session.user.id)
            .single(),
          supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", session.user.id),
        ]);

        const isAdmin = !!roles?.some((r: any) => r.role === "admin");
        const route = resolvePostAuthRoute(profile as any, { intent, returnTo, isAdmin });
        clearRoleIntentFromUrl();
        navigate(route, { replace: true });
      } catch (err) {
        console.error("OAuth callback unexpected error:", err);
        navigate("/login", { replace: true });
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-pulse-glow w-8 h-8 rounded-full bg-primary" />
    </div>
  );
};

export default AuthCallback;
