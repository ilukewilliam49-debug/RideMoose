/**
 * Single source of truth for post-authentication routing.
 *
 * Capability-based: a profile can independently hold any combination of
 * `is_rider`, `is_driver`, `is_business`. Admin privileges are tracked in
 * the separate `user_roles` table and passed in explicitly via `isAdmin`.
 */

import { supabase } from "@/integrations/supabase/client";

export type ActiveRole = "rider" | "driver" | "business" | "admin";

export interface RoutingProfile {
  is_driver?: boolean | null;
  is_rider?: boolean | null;
  is_business?: boolean | null;
  driver_onboarding_complete?: boolean | null;
  business_onboarding_complete?: boolean | null;
  rider_onboarding_complete?: boolean | null;
  last_used_role?: string | null;
}

export interface ResolveOptions {
  /** Explicit role intent from URL (e.g. ?role=driver / ?intent=business) */
  intent?: string | null;
  /** User-selected active role from ActiveRoleContext */
  activeRole?: ActiveRole | null;
  /** Explicit return path (e.g. ?returnTo=/business/apply). Honoured ahead
   *  of default role routing for non-admins. */
  returnTo?: string | null;
  /** Whether the user has the admin role in user_roles. */
  isAdmin?: boolean;
}

/** Whether a `returnTo` path is safe to honour (same-origin, not auth pages). */
export function isSafeReturnTo(path: string | null | undefined): path is string {
  if (!path || typeof path !== "string") return false;
  if (!path.startsWith("/")) return false;
  if (path.startsWith("//")) return false;
  if (path.startsWith("/login") || path.startsWith("/auth")) return false;
  return true;
}

export const STORAGE_KEY_ACTIVE_ROLE = "pickyou-active-role";

/** Normalise an intent value from the `intent` query param. */
export function normalizeIntent(raw: string | null | undefined): "rider" | "driver" | "business" | null {
  if (!raw) return null;
  const v = raw.toLowerCase();
  if (v === "rider" || v === "driver" || v === "business") return v;
  return null;
}

/**
 * Resolve the post-auth route. Priority:
 *  1. Admins → /admin (always, exclusive)
 *  2. Safe returnTo that targets a flow the user can access → honour it
 *  3. Explicit intent → that flow's landing page
 *  4. activeRole (in-session selection) → that flow if capability still held
 *  5. last_used_role (from profile) → that flow if capability still held
 *  6. Fallback → /rider
 */
export function resolvePostAuthRoute(
  profile: RoutingProfile | null | undefined,
  options: ResolveOptions = {},
): string {
  const intent = normalizeIntent(options.intent);

  if (!profile) {
    if (isSafeReturnTo(options.returnTo)) return options.returnTo;
    if (intent === "business") return "/business/apply";
    if (intent === "driver") return "/driver/onboarding";
    return "/rider";
  }

  // Admins are exclusive — never route them anywhere else
  if (options.isAdmin) return "/admin";

  // Honour safe returnTo for non-admins. Skip when it points into a flow the
  // user lacks the capability for AND can't acquire by visiting (we still
  // allow /business/apply because that page handles its own auth/cap state).
  if (isSafeReturnTo(options.returnTo)) {
    return options.returnTo;
  }

  // Explicit intent wins over default routing
  if (intent === "business") {
    return profile.is_business ? "/business" : "/business/apply";
  }
  if (intent === "driver") {
    return profile.driver_onboarding_complete ? "/driver" : "/driver/onboarding";
  }
  if (intent === "rider") {
    return "/rider";
  }

  // activeRole selection (current session)
  if (options.activeRole === "driver" && profile.is_driver) {
    return profile.driver_onboarding_complete ? "/driver" : "/driver/onboarding";
  }
  if (options.activeRole === "business" && profile.is_business) {
    return "/business";
  }
  if (options.activeRole === "rider") {
    return "/rider";
  }

  // last_used_role hint
  const last = profile.last_used_role;
  if (last === "driver" && profile.is_driver) {
    if (profile.driver_onboarding_complete) return "/driver";
    // Don't trap dual-role users in driver onboarding on every login —
    // fall back to /rider if they also hold the rider capability.
    if (profile.is_rider) return "/rider";
    return "/driver/onboarding";
  }
  if (last === "business" && profile.is_business) {
    return "/business";
  }
  if (last === "rider") {
    return "/rider";
  }

  // Fallback
  return "/rider";
}

/**
 * Strip role-intent query params from the current URL after they've been
 * consumed. Prevents repeated profile upgrades on subsequent navigations.
 */
export function clearRoleIntentFromUrl() {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (url.searchParams.has("intent")) {
    url.searchParams.delete("intent");
    window.history.replaceState({}, "", url.toString());
  }
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

/**
 * Given an intent, return the capability column to flip true.
 * Used by Login/AuthCallback to provision capabilities on demand.
 *
 * NOTE: `is_business` is intentionally NOT auto-provisioned — business
 * access requires admin approval via the /business/apply flow. We only
 * auto-grant `is_driver` and `is_rider`.
 */
export function intentToCapabilityColumn(
  intent: string | null | undefined,
): "is_driver" | "is_rider" | null {
  const i = normalizeIntent(intent);
  if (i === "driver") return "is_driver";
  if (i === "rider") return "is_rider";
  return null;
}

/**
 * Provision the capability flag matching `intent` for the *currently
 * authenticated* user via the SECURITY DEFINER `provision_capability` RPC.
 *
 * The RPC enforces:
 *   - the caller must be authenticated (uses auth.uid() server-side)
 *   - only `rider` and `driver` are accepted; `business` is a no-op
 *
 * Errors are swallowed and logged; provisioning failures should not block
 * the auth flow. The `userId` parameter is kept for backward compatibility
 * but is informational only — the server uses auth.uid().
 */
export async function provisionCapabilityFromIntent(
  userId: string | null | undefined,
  intent: string | null | undefined,
): Promise<void> {
  if (!userId) return;
  const capCol = intentToCapabilityColumn(intent);
  if (!capCol) return;
  try {
    // The RPC return type isn't in the generated types yet; cast to any to
    // avoid TS2589 ("excessively deep") on the rpc generic union.
    const { error } = await (supabase.rpc as any)("provision_capability", {
      _intent: intent,
    });
    if (error) {
      console.error("provisionCapabilityFromIntent RPC failed:", error.message);
    }
  } catch (err) {
    console.error("provisionCapabilityFromIntent unexpected error:", err);
  }
}
