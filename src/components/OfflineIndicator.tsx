import { WifiOff } from "lucide-react";
import { useIsOnline } from "@/hooks/useNetworkStatus";

export default function OfflineIndicator() {
  const isOnline = useIsOnline();
  if (isOnline) return null;

  return (
    <div className="flex items-center gap-1.5 rounded-full bg-destructive/15 px-2.5 py-1 text-xs font-medium text-destructive animate-in fade-in duration-300">
      <WifiOff className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">Offline</span>
    </div>
  );
}
