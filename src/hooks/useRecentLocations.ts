import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Per-user recent pickup/dropoff history.
 *
 * - Authenticated users: persisted in Supabase (`recent_locations`) so the
 *   list follows them across devices.
 * - Guests (logged out): falls back to localStorage so the landing page still
 *   feels personalized in the same browser.
 *
 * The hook always returns a fast initial value from localStorage so the UI
 * doesn't flash empty, then merges in the server list once authenticated.
 */

export type RecentLocation = {
  description: string;
  lat?: number;
  lng?: number;
  ts: number;
};

export type RecentKind = "pickup" | "dropoff" | "either";

const RECENTS_KEY = "pickyou:recent_locations";
const MAX_RECENTS = 6;

// ─────────────────── localStorage helpers (guest fallback) ──────────────────

const readLocalRecents = (): RecentLocation[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r) => r && typeof r.description === "string" && typeof r.ts === "number"
    );
  } catch {
    return [];
  }
};

const writeLocalRecents = (entry: RecentLocation) => {
  if (typeof window === "undefined") return;
  try {
    const current = readLocalRecents();
    const deduped = current.filter(
      (r) => r.description.toLowerCase() !== entry.description.toLowerCase()
    );
    const next = [entry, ...deduped].slice(0, MAX_RECENTS);
    window.localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    /* quota exhausted — ignore */
  }
};

// ───────────────────────────────── Hook ─────────────────────────────────────

export const useRecentLocations = (kind: RecentKind = "either") => {
  const [userId, setUserId] = useState<string | null>(null);
  const [recents, setRecents] = useState<RecentLocation[]>(() =>
    readLocalRecents()
  );
  const requestIdRef = useRef(0);

  // Track auth state — re-fetch when the user logs in/out.
  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return;
      setUserId(session?.user?.id ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUserId(session?.user?.id ?? null);
      }
    );

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  // Load recents from Supabase whenever auth changes.
  useEffect(() => {
    if (!userId) {
      // Guest — keep localStorage list in state.
      setRecents(readLocalRecents());
      return;
    }

    const myReq = ++requestIdRef.current;
    (async () => {
      const query = supabase
        .from("recent_locations")
        .select("description, lat, lng, last_used_at, kind")
        .eq("user_id", userId)
        .order("last_used_at", { ascending: false })
        .limit(MAX_RECENTS);

      // Show entries matching this side (pickup/dropoff) plus generic "either"
      if (kind !== "either") {
        query.in("kind", [kind, "either"]);
      }

      const { data, error } = await query;
      if (myReq !== requestIdRef.current) return;
      if (error || !data) return;

      setRecents(
        data.map((row) => ({
          description: row.description,
          lat: row.lat ?? undefined,
          lng: row.lng ?? undefined,
          ts: new Date(row.last_used_at).getTime(),
        }))
      );
    })();
  }, [userId, kind]);

  /**
   * Record a new recent location. Writes to Supabase if authenticated, and
   * always updates localStorage so guests keep history in the same browser.
   */
  const addRecent = useCallback(
    async (
      entry: Omit<RecentLocation, "ts">,
      entryKind: RecentKind = kind
    ) => {
      const trimmed = entry.description?.trim();
      if (!trimmed) return;

      const ts = Date.now();
      const next: RecentLocation = { ...entry, description: trimmed, ts };

      // Local fallback (also helps guests see immediate effect)
      writeLocalRecents(next);

      // Optimistic UI update
      setRecents((prev) => {
        const deduped = prev.filter(
          (r) => r.description.toLowerCase() !== trimmed.toLowerCase()
        );
        return [next, ...deduped].slice(0, MAX_RECENTS);
      });

      if (!userId) return;

      // Upsert by (user_id, lower(description), kind) — handled by unique index.
      // We update last_used_at on conflict so the row floats to the top.
      try {
        await supabase.from("recent_locations").upsert(
          {
            user_id: userId,
            description: trimmed,
            lat: entry.lat ?? null,
            lng: entry.lng ?? null,
            kind: entryKind,
            last_used_at: new Date(ts).toISOString(),
          },
          { onConflict: "user_id,description,kind", ignoreDuplicates: false }
        );
      } catch {
        /* network/race — local copy still reflects the change */
      }
    },
    [userId, kind]
  );

  return { recents, addRecent };
};
