import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

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

        // Honour ?role=driver intent across the OAuth round-trip. We only flip
        // the `is_driver` capability flag — we never overwrite the primary
        // role (admins stay admin; existing riders keep their role too).
        const params = new URLSearchParams(window.location.search);
        const roleParam = params.get("role");
        if (roleParam === "driver") {
          await supabase
            .from("profiles")
            .update({ is_driver: true } as any)
            .eq("user_id", session.user.id)
            .neq("role", "admin");
        }

        // Fetch profile to determine role-based redirect
        const { data: profile } = await supabase
          .from("profiles")
          .select("role, is_driver, driver_onboarding_complete")
          .eq("user_id", session.user.id)
          .single();

        let route = "/rider";
        if (profile?.role === "admin") {
          route = "/admin";
        } else if (roleParam === "driver" || (profile as any)?.is_driver) {
          // Send to onboarding when the driver hasn't finished setup yet,
          // otherwise to the driver dashboard.
          route = (profile as any)?.driver_onboarding_complete ? "/driver" : "/driver/onboarding";
        }

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
