import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { clearActiveRoleStorage } from "@/lib/post-auth-route";

export interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  phone: string | null;
  phone_verified: boolean;
  avatar_url: string | null;
  is_rider: boolean;
  is_driver: boolean;
  is_business: boolean;
  rider_onboarding_complete: boolean;
  driver_onboarding_complete: boolean;
  business_onboarding_complete: boolean;
  last_used_role: string | null;
  is_available: boolean;
  latitude: number | null;
  longitude: number | null;
  can_taxi: boolean;
  can_private_hire: boolean;
  can_shuttle: boolean;
  can_courier: boolean;
  vehicle_type: string | null;
  seat_capacity: number | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_year: number | null;
  vehicle_color: string | null;
  license_plate: string | null;
  driver_balance_cents: number;
  commission_rate: number;
  promo_commission_rate: number;
  promo_end_date: string | null;
  launch_start_date: string | null;
  went_online_at: string | null;
  organization_id: string | null;
  role_in_org: string | null;
  sms_notifications_enabled: boolean;
  standard_commission_rate: number;
  created_at: string;
  updated_at: string;
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [expiredEmail, setExpiredEmail] = useState<string | undefined>();

  const clearSessionExpired = useCallback(() => {
    setSessionExpired(false);
    setExpiredEmail(undefined);
  }, []);

  useEffect(() => {
    const fetchProfileAndRoles = async (userId: string) => {
      const [{ data: profileData }, { data: rolesData }] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", userId).single(),
        supabase.from("user_roles").select("role").eq("user_id", userId),
      ]);
      setProfile(profileData as Profile | null);
      setIsAdmin(!!rolesData?.some((r) => r.role === "admin"));
      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "TOKEN_REFRESHED") {
          clearSessionExpired();
        }

        setUser(session?.user ?? null);
        if (session?.user) {
          clearSessionExpired();

          // Capability provisioning from URL intent. Intent only flips the
          // corresponding capability flag if not already set; admin status
          // lives in user_roles and is unaffected.
          if (event === "SIGNED_IN") {
            const params = new URLSearchParams(window.location.search);
            const intent = (params.get("intent") || params.get("role") || "").toLowerCase();
            const capCol =
              intent === "driver" ? "is_driver"
              : intent === "business" ? "is_business"
              : intent === "rider" ? "is_rider"
              : null;
            if (capCol) {
              await supabase
                .from("profiles")
                .update({ [capCol]: true } as any)
                .eq("user_id", session.user.id);
            }
          }

          setTimeout(() => fetchProfileAndRoles(session.user.id), 0);
        } else {
          setProfile(null);
          setIsAdmin(false);
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error && error.message?.includes("refresh_token")) {
        const lastEmail = user?.email;
        setExpiredEmail(lastEmail || undefined);
        setSessionExpired(true);
        setUser(null);
        setProfile(null);
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfileAndRoles(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const handleVisibility = async () => {
      if (document.visibilityState === "visible") {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || (!session && user)) {
          setExpiredEmail(user?.email || undefined);
          setSessionExpired(true);
          setUser(null);
          setProfile(null);
          setIsAdmin(false);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      subscription.unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  const signOut = async () => {
    clearSessionExpired();
    clearActiveRoleStorage();
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setIsAdmin(false);
  };

  return { user, profile, isAdmin, loading, signOut, sessionExpired, expiredEmail, clearSessionExpired };
};
