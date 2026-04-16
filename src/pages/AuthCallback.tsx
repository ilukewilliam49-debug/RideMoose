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
