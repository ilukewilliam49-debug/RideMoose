import { useState, useEffect } from "react";
import { WifiOff } from "lucide-react";

const OfflineBanner = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const goOffline = () => {
      setIsOffline(true);
      setWasOffline(true);
    };
    const goOnline = () => {
      setIsOffline(false);
      // Auto-hide "back online" after 3s
      setTimeout(() => setWasOffline(false), 3000);
    };

    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  if (!isOffline && !wasOffline) return null;

  return (
    <div
      className={`fixed top-0 inset-x-0 z-[100] flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium transition-colors duration-300 ${
        isOffline
          ? "bg-destructive text-destructive-foreground"
          : "bg-green-600 text-white"
      }`}
    >
      {isOffline ? (
        <>
          <WifiOff className="h-4 w-4" />
          You're offline — check your connection
        </>
      ) : (
        "Back online"
      )}
    </div>
  );
};

export default OfflineBanner;
