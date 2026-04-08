import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  phone: string | null;
  phone_verified: boolean;
  avatar_url: string | null;
  role: "rider" | "driver" | "admin";
  is_available: boolean;
  latitude: number | null;
  longitude: number | null;
  can_taxi: boolean;
  can_private_hire: boolean;
  can_shuttle: boolean;
  can_courier: boolean;
  can_food_delivery: boolean;
  pet_approved: boolean;
  vehicle_type: string | null;
  seat_capacity: number | null;
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
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [expiredEmail, setExpiredEmail] = useState<string | undefined>();

  const clearSessionExpired = useCallback(() => {
    setSessionExpired(false);
    setExpiredEmail(undefined);
  }, []);

  useEffect(() => {
    const fetchProfile = async (userId: string) => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .single();
      setProfile(data as Profile | null);
      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "TOKEN_REFRESHED") {
          // Successfully refreshed — clear any expired state
          clearSessionExpired();
        }

        if (event === "SIGNED_OUT") {
          // Only show expired dialog if we had a user before (not manual sign-out)
          // Manual sign-out sets user to null before this fires
        }

        setUser(session?.user ?? null);
        if (session?.user) {
          clearSessionExpired();
          setTimeout(() => fetchProfile(session.user.id), 0);
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error && error.message?.includes("refresh_token")) {
        // Token refresh failed — session expired
        const lastEmail = user?.email;
        setExpiredEmail(lastEmail || undefined);
        setSessionExpired(true);
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth errors that indicate expired tokens
    const handleVisibility = async () => {
      if (document.visibilityState === "visible") {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || (!session && user)) {
          setExpiredEmail(user?.email || undefined);
          setSessionExpired(true);
          setUser(null);
          setProfile(null);
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
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  return { user, profile, loading, signOut, sessionExpired, expiredEmail, clearSessionExpired };
};
