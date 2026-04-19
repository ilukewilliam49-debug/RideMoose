import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export type ActiveRole = "rider" | "driver" | "business" | "admin";

interface ActiveRoleContextType {
  activeRole: ActiveRole;
  setActiveRole: (role: ActiveRole) => void;
  /** True when the user holds 2+ non-admin capabilities and can switch. */
  canSwitch: boolean;
  /** Default role inferred from capabilities + last_used_role. */
  defaultRole: ActiveRole;
  /** Capability set held by the user. */
  capabilities: { rider: boolean; driver: boolean; business: boolean };
}

const ActiveRoleContext = createContext<ActiveRoleContextType | undefined>(undefined);

const STORAGE_KEY = "pickyou-active-role";

function inferDefaultRole(profile: any, isAdmin: boolean): ActiveRole {
  if (!profile) return "rider";
  if (isAdmin) return "admin";
  const last = profile.last_used_role;
  if (last === "driver" && profile.is_driver) return "driver";
  if (last === "business" && profile.is_business) return "business";
  if (last === "rider" && profile.is_rider) return "rider";
  // Fallback by capability — driver gets priority over business as it's a
  // dedicated dashboard; rider is the universal default.
  if (profile.is_driver) return "driver";
  if (profile.is_business) return "business";
  return "rider";
}

export function ActiveRoleProvider({ children }: { children: ReactNode }) {
  const { profile, user, isAdmin } = useAuth();
  const defaultRole: ActiveRole = inferDefaultRole(profile, isAdmin);

  const capabilities = {
    rider: !!profile?.is_rider,
    driver: !!profile?.is_driver,
    business: !!profile?.is_business,
  };

  const heldCapabilityCount =
    (capabilities.rider ? 1 : 0) +
    (capabilities.driver ? 1 : 0) +
    (capabilities.business ? 1 : 0);

  const canSwitch = !isAdmin && heldCapabilityCount >= 2;

  const [activeRole, setActiveRoleState] = useState<ActiveRole>(() => {
    if (typeof window === "undefined") return defaultRole;
    const stored = localStorage.getItem(STORAGE_KEY) as ActiveRole | null;
    return stored || defaultRole;
  });

  // Sync when profile loads or changes
  useEffect(() => {
    if (!profile) return;
    const stored = localStorage.getItem(STORAGE_KEY) as ActiveRole | null;
    const validStored =
      stored &&
      (stored === "rider" || stored === "driver" || stored === "business") &&
      capabilities[stored];
    if (canSwitch && validStored) {
      setActiveRoleState(stored as ActiveRole);
    } else {
      setActiveRoleState(defaultRole);
      if (stored && !validStored) localStorage.removeItem(STORAGE_KEY);
    }
  }, [profile?.id, defaultRole, canSwitch, capabilities.rider, capabilities.driver, capabilities.business]);

  // Clear on sign-out
  useEffect(() => {
    if (!user) {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [user]);

  const setActiveRole = useCallback((role: ActiveRole) => {
    if (role === "admin") return; // admin is not user-selectable
    if (!canSwitch && role !== defaultRole) return;
    if (role === "rider" && !capabilities.rider) return;
    if (role === "driver" && !capabilities.driver) return;
    if (role === "business" && !capabilities.business) return;
    setActiveRoleState(role);
    localStorage.setItem(STORAGE_KEY, role);
    // Persist last_used_role for next session (best-effort, ignore errors)
    if (profile?.user_id) {
      supabase
        .from("profiles")
        .update({ last_used_role: role } as any)
        .eq("user_id", profile.user_id)
        .then(() => {});
    }
  }, [canSwitch, defaultRole, capabilities, profile?.user_id]);

  return (
    <ActiveRoleContext.Provider value={{ activeRole, setActiveRole, canSwitch, defaultRole, capabilities }}>
      {children}
    </ActiveRoleContext.Provider>
  );
}

export function useActiveRole() {
  const ctx = useContext(ActiveRoleContext);
  if (!ctx) throw new Error("useActiveRole must be used within ActiveRoleProvider");
  return ctx;
}
