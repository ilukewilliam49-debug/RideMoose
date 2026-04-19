import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";

export type BookingFor = "self" | "guest";

export interface RideBookingPlan {
  scheduledAt: Date | null;
  bookingFor: BookingFor;
  guestName: string;
  guestPhone: string;
}

interface RideBookingContextValue extends RideBookingPlan {
  setScheduledAt: (d: Date | null) => void;
  setBookingFor: (b: BookingFor) => void;
  setGuestName: (n: string) => void;
  setGuestPhone: (p: string) => void;
  setGuest: (name: string, phone: string) => void;
  resetGuest: () => void;
  resetSchedule: () => void;
  resetAll: () => void;
}

const STORAGE_KEY = "pickyou_ride_plan_v1";

const RideBookingContext = createContext<RideBookingContextValue | null>(null);

const loadInitial = (): RideBookingPlan => {
  if (typeof window === "undefined") {
    return { scheduledAt: null, bookingFor: "self", guestName: "", guestPhone: "" };
  }
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { scheduledAt: null, bookingFor: "self", guestName: "", guestPhone: "" };
    const parsed = JSON.parse(raw);
    const scheduledAt = parsed.scheduledAt ? new Date(parsed.scheduledAt) : null;
    // Drop past schedules on reload
    const valid = scheduledAt && scheduledAt.getTime() > Date.now() ? scheduledAt : null;
    return {
      scheduledAt: valid,
      bookingFor: parsed.bookingFor === "guest" ? "guest" : "self",
      guestName: typeof parsed.guestName === "string" ? parsed.guestName : "",
      guestPhone: typeof parsed.guestPhone === "string" ? parsed.guestPhone : "",
    };
  } catch {
    return { scheduledAt: null, bookingFor: "self", guestName: "", guestPhone: "" };
  }
};

export const RideBookingProvider = ({ children }: { children: ReactNode }) => {
  const initial = loadInitial();
  const [scheduledAt, setScheduledAtState] = useState<Date | null>(initial.scheduledAt);
  const [bookingFor, setBookingForState] = useState<BookingFor>(initial.bookingFor);
  const [guestName, setGuestNameState] = useState(initial.guestName);
  const [guestPhone, setGuestPhoneState] = useState(initial.guestPhone);

  // Persist on every change
  useEffect(() => {
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          scheduledAt: scheduledAt ? scheduledAt.toISOString() : null,
          bookingFor,
          guestName,
          guestPhone,
        })
      );
    } catch {
      // ignore storage failures (quota, private mode)
    }
  }, [scheduledAt, bookingFor, guestName, guestPhone]);

  const setScheduledAt = useCallback((d: Date | null) => {
    if (d && d.getTime() <= Date.now()) {
      // Past time → treat as "now"
      setScheduledAtState(null);
      return;
    }
    setScheduledAtState(d);
  }, []);

  const setBookingFor = useCallback((b: BookingFor) => {
    setBookingForState(b);
    if (b === "self") {
      setGuestNameState("");
      setGuestPhoneState("");
    }
  }, []);

  const setGuest = useCallback((name: string, phone: string) => {
    setGuestNameState(name);
    setGuestPhoneState(phone);
  }, []);

  const resetGuest = useCallback(() => {
    setBookingForState("self");
    setGuestNameState("");
    setGuestPhoneState("");
  }, []);

  const resetSchedule = useCallback(() => setScheduledAtState(null), []);

  const resetAll = useCallback(() => {
    setScheduledAtState(null);
    setBookingForState("self");
    setGuestNameState("");
    setGuestPhoneState("");
  }, []);

  return (
    <RideBookingContext.Provider
      value={{
        scheduledAt,
        bookingFor,
        guestName,
        guestPhone,
        setScheduledAt,
        setBookingFor,
        setGuestName: setGuestNameState,
        setGuestPhone: setGuestPhoneState,
        setGuest,
        resetGuest,
        resetSchedule,
        resetAll,
      }}
    >
      {children}
    </RideBookingContext.Provider>
  );
};

export const useRideBooking = () => {
  const ctx = useContext(RideBookingContext);
  if (!ctx) throw new Error("useRideBooking must be used within RideBookingProvider");
  return ctx;
};
