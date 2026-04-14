import { useEffect, useRef } from "react";
import { toast } from "sonner";

export function useNetworkStatus() {
  const wasOffline = useRef(false);

  useEffect(() => {
    const handleOffline = () => {
      wasOffline.current = true;
      toast.error("You're offline", {
        description: "Check your internet connection",
        duration: Infinity,
        id: "network-status",
      });
    };

    const handleOnline = () => {
      toast.dismiss("network-status");
      if (wasOffline.current) {
        wasOffline.current = false;
        toast.success("Back online", {
          description: "Your connection has been restored",
          duration: 3000,
        });
      }
    };

    // Set initial state
    if (!navigator.onLine) {
      handleOffline();
    }

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);
}
