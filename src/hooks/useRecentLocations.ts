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
const SYNC_PREF_KEY = "pickyou:recents_sync_disabled";
const MAX_RECENTS = 6;

/**
 * Whether the user has opted out of cross-device syncing of recent
 * pickup/dropoff locations. When `true`, the hook only reads/writes
 * localStorage and never touches Supabase.
 */
export const isRecentLocationsSyncDisabled = (): boolean => {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(SYNC_PREF_KEY) === "1";
  } catch {
    return false;
  }
};

export const setRecentLocationsSyncDisabled = (disabled: boolean) => {
  if (typeof window === "undefined") return;
  try {
    if (disabled) {
      window.localStorage.setItem(SYNC_PREF_KEY, "1");
    } else {
      window.localStorage.removeItem(SYNC_PREF_KEY);
    }
    // Notify the same-tab hook instance so it can refresh state.
    window.dispatchEvent(new Event("pickyou:recents-sync-pref-changed"));
  } catch {
    /* ignore quota / storage errors */
  }
};

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
  const [syncDisabled, setSyncDisabled] = useState<boolean>(() =>
    isRecentLocationsSyncDisabled()
  );
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

  // React to sync-pref changes (other tabs via `storage`, same tab via custom event).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const refresh = () => setSyncDisabled(isRecentLocationsSyncDisabled());
    const onStorage = (e: StorageEvent) => {
      if (e.key === SYNC_PREF_KEY) refresh();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("pickyou:recents-sync-pref-changed", refresh);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("pickyou:recents-sync-pref-changed", refresh);
    };
  }, []);

  // Load recents from Supabase whenever auth/sync-pref changes.
  useEffect(() => {
    if (!userId || syncDisabled) {
      // Guest, or sync turned off — keep localStorage list in state.
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
  }, [userId, kind, syncDisabled]);

  /**
   * Record a new recent location. Writes to Supabase if authenticated AND
   * sync is enabled, and always updates localStorage so guests / opted-out
   * users keep history in the same browser.
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

      if (!userId || syncDisabled) return;

      // The unique index uses lower(description), which Postgrest can't
      // reference via onConflict. Do a manual upsert: delete any prior
      // case-insensitive match for this user+kind, then insert fresh so
      // last_used_at floats it to the top.
      try {
        await supabase
          .from("recent_locations")
          .delete()
          .eq("user_id", userId)
          .eq("kind", entryKind)
          .ilike("description", trimmed);

        await supabase.from("recent_locations").insert({
          user_id: userId,
          description: trimmed,
          lat: entry.lat ?? null,
          lng: entry.lng ?? null,
          kind: entryKind,
          last_used_at: new Date(ts).toISOString(),
        });
      } catch {
        /* network/race — local copy still reflects the change */
      }
    },
    [userId, kind, syncDisabled]
  );

  return { recents, addRecent, syncDisabled };
};
