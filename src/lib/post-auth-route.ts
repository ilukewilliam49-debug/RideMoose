/**
 * Single source of truth for post-authentication routing.
 *
 * Resolves the correct landing route based on:
 *   - profile capabilities (admin / driver / rider)
 *   - URL intent (?role=driver from Drive CTA / OAuth round-trip)
 *   - current activeRole selection (for dual-capability users)
 *
 * Used by Login, AuthCallback, and Index to eliminate duplicate
 * redirect logic and inconsistent landing pages.
 */

export type ActiveRole = "rider" | "driver" | "admin";

export interface RoutingProfile {
  role?: "rider" | "driver" | "admin" | null;
  is_driver?: boolean | null;
  is_rider?: boolean | null;
  driver_onboarding_complete?: boolean | null;
}

export interface ResolveOptions {
  /** Explicit role intent from URL (e.g. ?role=driver) */
  intent?: string | null;
  /** User-selected active role from ActiveRoleContext */
  activeRole?: ActiveRole | null;
}

export const STORAGE_KEY_ACTIVE_ROLE = "pickyou-active-role";

/**
 * Resolve the post-auth route. Priority:
 *  1. Admins → /admin (always)
 *  2. Explicit ?role=driver intent → driver flow (onboarding or dashboard)
 *  3. Driver-capable + activeRole === 'driver' → driver flow
 *  4. Driver-capable + activeRole === 'rider' → /rider
 *  5. Default → /rider
 */
export function resolvePostAuthRoute(
  profile: RoutingProfile | null | undefined,
  options: ResolveOptions = {},
): string {
  if (!profile) return "/rider";

  // Admins are exclusive — never route them anywhere else
  if (profile.role === "admin") return "/admin";

  const driverReady = !!profile.driver_onboarding_complete;
  const driverRoute = driverReady ? "/driver" : "/driver/onboarding";
  const isDriverCapable = !!profile.is_driver;

  // Explicit URL intent always wins (even before profile flags update)
  if (options.intent === "driver") return driverRoute;

  if (isDriverCapable) {
    // Dual-capable user: respect their last-selected mode
    if (options.activeRole === "rider") return "/rider";
    return driverRoute;
  }

  return "/rider";
}

/**
 * Strip role-intent query params from the current URL after they've been
 * consumed. Prevents repeated profile upgrades on subsequent navigations
 * and keeps the address bar clean.
 */
export function clearRoleIntentFromUrl() {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has("role")) return;
  url.searchParams.delete("role");
  window.history.replaceState({}, "", url.toString());
}

/** Clear all role-related localStorage keys. Call from signOut. */
export function clearActiveRoleStorage() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY_ACTIVE_ROLE);
  } catch {
    /* ignore */
  }
}
