import { useState, useEffect } from "react";
import { WifiOff, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const NetworkErrorBanner = () => {
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const onOnline = () => setOffline(false);
    const onOffline = () => setOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  return (
    <AnimatePresence>
      {offline && (
        <motion.div
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          className="fixed top-0 left-0 right-0 z-[9998] flex items-center justify-center gap-2 bg-destructive px-4 py-3 text-destructive-foreground safe-top"
        >
          <WifiOff className="h-4 w-4 shrink-0" />
          <span className="text-sm font-medium">No internet connection</span>
          <button
            onClick={() => window.location.reload()}
            className="ml-2 flex items-center gap-1 rounded-full bg-destructive-foreground/20 px-3 py-1 text-xs font-semibold"
          >
            <RefreshCw className="h-3 w-3" />
            Retry
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default NetworkErrorBanner;
