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
const WARNING_MS = 60 * 1000; // 60 second warning
const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
  "wheel",
] as const;

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

  useEffect(() => {
    if (!enabled) {
      clearIdleTimer();
      clearCountdown();
      setOpen(false);
      return;
    }

    const handleActivity = () => {
      // Don't reset while warning dialog is showing — user must explicitly stay signed in
      if (open) return;
      resetIdleTimer();
    };

    ACTIVITY_EVENTS.forEach((evt) =>
      window.addEventListener(evt, handleActivity, { passive: true })
    );

    resetIdleTimer();

    return () => {
      ACTIVITY_EVENTS.forEach((evt) =>
        window.removeEventListener(evt, handleActivity)
      );
      clearIdleTimer();
      clearCountdown();
    };
  }, [enabled, open, resetIdleTimer]);

  const handleStaySignedIn = async () => {
    clearCountdown();
    setOpen(false);
    try {
      await supabase.auth.refreshSession();
    } catch {
      // noop — onAuthStateChange will surface any session issues
    }
    resetIdleTimer();
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
