import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";

function subscribe(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

function getSnapshot() {
  return navigator.onLine;
}

export function useIsOnline() {
  return useSyncExternalStore(subscribe, getSnapshot, () => true);
}

export function useNetworkStatus() {
  const isOnline = useIsOnline();
  const wasOffline = useRef(false);

  useEffect(() => {
    if (!isOnline) {
      wasOffline.current = true;
      toast.error("You're offline", {
        description: "Check your internet connection",
        duration: Infinity,
        id: "network-status",
      });
    } else {
      toast.dismiss("network-status");
      if (wasOffline.current) {
        wasOffline.current = false;
        toast.success("Back online", {
          description: "Your connection has been restored",
          duration: 3000,
        });
      }
    }
  }, [isOnline]);

  return isOnline;
}
