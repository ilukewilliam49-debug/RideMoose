import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Supabase automatically picks up the tokens from the URL hash/query
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error || !session) {
          console.error("OAuth callback error:", error?.message);
          navigate("/login", { replace: true });
          return;
        }

        // If the login flow preserved ?role=driver across the OAuth round-trip,
        // promote the user to a driver profile before deciding where to route.
        const params = new URLSearchParams(window.location.search);
        const roleParam = params.get("role");
        if (roleParam === "driver") {
          // Update auth metadata so the profile trigger sees it for new users,
          // and update existing profile rows for returning users. Admins are
          // never demoted (we only upgrade rider → driver).
          await supabase.auth.updateUser({ data: { role: "driver" } });
          await supabase
            .from("profiles")
            .update({ role: "driver" as any })
            .eq("user_id", session.user.id)
            .neq("role", "admin");
        }

        // Fetch profile to determine role-based redirect
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("user_id", session.user.id)
          .single();

        const route =
          profile?.role === "admin"
            ? "/admin"
            : profile?.role === "driver"
              ? "/driver"
              : "/rider";

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
