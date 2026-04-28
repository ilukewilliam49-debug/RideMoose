import { useEffect, useState } from "react";

const STORAGE_KEY = "pickyou:passengerCount";
const MIN = 1;
const MAX = 6;

const clamp = (n: number) => Math.min(MAX, Math.max(MIN, Math.round(n)));

const readInitial = (fallback: number): number => {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = parseInt(raw, 10);
    if (!Number.isFinite(parsed)) return fallback;
    return clamp(parsed);
  } catch {
    return fallback;
  }
};

/**
 * Persistent passenger count shared across the homepage booking widget,
 * the /ride info page, and the post-login booking flow. Backed by
 * localStorage and synced across tabs via the `storage` event.
 */
export const usePassengerCount = (fallback: number = 1) => {
  const [count, setCount] = useState<number>(() => readInitial(fallback));

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, String(count));
    } catch {
      /* ignore quota / privacy mode */
    }
  }, [count]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      const parsed = parseInt(e.newValue, 10);
      if (Number.isFinite(parsed)) setCount(clamp(parsed));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const update = (n: number) => setCount(clamp(n));
  return [count, update] as const;
};

export const PASSENGER_COUNT_STORAGE_KEY = STORAGE_KEY;
