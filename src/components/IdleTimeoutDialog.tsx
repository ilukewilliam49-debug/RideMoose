import { useEffect, useRef, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const IDLE_MS = 25 * 60 * 1000; // 25 minutes
const BROADCAST_THROTTLE_MS = 2000; // throttle cross-tab activity pings
const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
  "wheel",
] as const;

const CHANNEL_NAME = "pickyou.idle";
const STORAGE_KEY = "pickyou.idle.ping";
const MSG_ACTIVITY = "activity";
const MSG_STAY = "stay";

interface IdleTimeoutDialogProps {
  enabled: boolean;
  onSignOut: () => void;
}

const IdleTimeoutDialog = ({ enabled, onSignOut }: IdleTimeoutDialogProps) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(60);

  const idleTimer = useRef<number | null>(null);
  const countdownTimer = useRef<number | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const lastBroadcastRef = useRef<number>(0);
  const openRef = useRef(false);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  const clearIdleTimer = () => {
    if (idleTimer.current !== null) {
      window.clearTimeout(idleTimer.current);
      idleTimer.current = null;
    }
  };

  const clearCountdown = () => {
    if (countdownTimer.current !== null) {
      window.clearInterval(countdownTimer.current);
      countdownTimer.current = null;
    }
  };

  const startCountdown = useCallback(() => {
    setSecondsLeft(60);
    setOpen(true);
    clearCountdown();
    countdownTimer.current = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearCountdown();
          setOpen(false);
          onSignOut();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }, [onSignOut]);

  const resetIdleTimer = useCallback(() => {
    clearIdleTimer();
    idleTimer.current = window.setTimeout(startCountdown, IDLE_MS);
  }, [startCountdown]);

  // Broadcast activity to other tabs (throttled)
  const broadcast = useCallback((type: string) => {
    const now = Date.now();
    if (type === MSG_ACTIVITY && now - lastBroadcastRef.current < BROADCAST_THROTTLE_MS) {
      return;
    }
    lastBroadcastRef.current = now;
    const payload = { type, ts: now };
    try {
      channelRef.current?.postMessage(payload);
    } catch {
      // noop
    }
    // localStorage fallback so 'storage' listeners in other tabs fire
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // noop
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      clearIdleTimer();
      clearCountdown();
      setOpen(false);
      return;
    }

    // Set up cross-tab channel
    if ("BroadcastChannel" in window) {
      try {
        channelRef.current = new BroadcastChannel(CHANNEL_NAME);
      } catch {
        channelRef.current = null;
      }
    }

    const handleRemoteSignal = (type: string) => {
      if (type === MSG_STAY) {
        // Another tab refreshed the session — close our warning if open
        clearCountdown();
        setOpen(false);
        resetIdleTimer();
        return;
      }
      if (type === MSG_ACTIVITY) {
        // Don't reset while our warning dialog is open — user must explicitly stay
        if (openRef.current) return;
        resetIdleTimer();
      }
    };

    const onChannelMessage = (e: MessageEvent) => {
      const data = e.data as { type?: string } | null;
      if (data?.type) handleRemoteSignal(data.type);
    };

    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      try {
        const data = JSON.parse(e.newValue) as { type?: string };
        if (data?.type) handleRemoteSignal(data.type);
      } catch {
        // noop
      }
    };

    channelRef.current?.addEventListener("message", onChannelMessage);
    window.addEventListener("storage", onStorage);

    const handleActivity = () => {
      if (openRef.current) return;
      resetIdleTimer();
      broadcast(MSG_ACTIVITY);
    };

    ACTIVITY_EVENTS.forEach((evt) =>
      window.addEventListener(evt, handleActivity, { passive: true })
    );

    resetIdleTimer();

    return () => {
      ACTIVITY_EVENTS.forEach((evt) =>
        window.removeEventListener(evt, handleActivity)
      );
      window.removeEventListener("storage", onStorage);
      channelRef.current?.removeEventListener("message", onChannelMessage);
      try {
        channelRef.current?.close();
      } catch {
        // noop
      }
      channelRef.current = null;
      clearIdleTimer();
      clearCountdown();
    };
  }, [enabled, resetIdleTimer, broadcast]);

  const handleStaySignedIn = async () => {
    clearCountdown();
    setOpen(false);
    try {
      await supabase.auth.refreshSession();
    } catch {
      // noop — onAuthStateChange will surface any session issues
    }
    resetIdleTimer();
    broadcast(MSG_STAY);
  };

  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="z-[1300]">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("auth.idleTimeoutTitle", "Are you still there?")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("auth.idleTimeoutDesc", {
              defaultValue: "You'll be signed out in {{seconds}} seconds.",
              seconds: secondsLeft,
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" onClick={onSignOut}>
            {t("auth.signOutNow", "Sign out now")}
          </Button>
          <AlertDialogAction onClick={handleStaySignedIn}>
            {t("auth.staySignedIn", "Stay signed in")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default IdleTimeoutDialog;
