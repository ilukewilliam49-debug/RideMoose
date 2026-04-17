import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { useAuth, type Profile } from "@/hooks/useAuth";

type ActiveRole = "rider" | "driver" | "admin";

interface ActiveRoleContextType {
  activeRole: ActiveRole;
  setActiveRole: (role: ActiveRole) => void;
  canSwitch: boolean;
  dbRole: ActiveRole;
}

const ActiveRoleContext = createContext<ActiveRoleContextType | undefined>(undefined);

const STORAGE_KEY = "pickyou-active-role";

export function ActiveRoleProvider({ children }: { children: ReactNode }) {
  const { profile, user } = useAuth();
  const dbRole: ActiveRole = (profile?.role as ActiveRole) || "rider";
  // A user can switch into Driver mode only if they (a) hold the driver
  // capability AND (b) have completed driver onboarding. Riders who have
  // never opted in still see the regular rider UI.
  const canSwitch =
    !!profile?.is_driver &&
    !!profile?.is_rider &&
    !!profile?.driver_onboarding_complete &&
    dbRole !== "admin";

  const [activeRole, setActiveRoleState] = useState<ActiveRole>(() => {
    if (typeof window === "undefined") return dbRole;
    const stored = localStorage.getItem(STORAGE_KEY) as ActiveRole | null;
    return stored || dbRole;
  });

  // Sync when profile loads or changes
  useEffect(() => {
    if (!profile) return;
    const stored = localStorage.getItem(STORAGE_KEY) as ActiveRole | null;
    if (canSwitch && stored && (stored === "rider" || stored === "driver")) {
      setActiveRoleState(stored);
    } else {
      setActiveRoleState(dbRole);
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [profile?.id, dbRole, canSwitch]);

  // Clear on sign-out
  useEffect(() => {
    if (!user) {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [user]);

  const setActiveRole = useCallback((role: ActiveRole) => {
    if (!canSwitch && role !== dbRole) return;
    setActiveRoleState(role);
    localStorage.setItem(STORAGE_KEY, role);
  }, [canSwitch, dbRole]);

  return (
    <ActiveRoleContext.Provider value={{ activeRole, setActiveRole, canSwitch, dbRole }}>
      {children}
    </ActiveRoleContext.Provider>
  );
}

export function useActiveRole() {
  const ctx = useContext(ActiveRoleContext);
  if (!ctx) throw new Error("useActiveRole must be used within ActiveRoleProvider");
  return ctx;
}
