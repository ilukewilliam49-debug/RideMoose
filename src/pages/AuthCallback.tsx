import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  resolvePostAuthRoute,
  clearRoleIntentFromUrl,
  intentToCapabilityColumn,
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
        const intent = params.get("intent") || params.get("role");
        const returnTo = params.get("returnTo");

        // Provision the matching capability without overwriting `role`.
        // Admins are explicitly excluded so they never get downgraded.
        const capCol = intentToCapabilityColumn(intent);
        if (capCol) {
          await supabase
            .from("profiles")
            .update({ [capCol]: true } as any)
            .eq("user_id", session.user.id)
            .neq("role", "admin");
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("role, is_driver, is_rider, is_business, driver_onboarding_complete, business_onboarding_complete, rider_onboarding_complete, last_used_role")
          .eq("user_id", session.user.id)
          .single();

        const route = resolvePostAuthRoute(profile as any, { intent, returnTo });
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
