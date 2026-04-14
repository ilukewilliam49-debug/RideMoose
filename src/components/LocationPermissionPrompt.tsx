import { useState } from "react";
import { MapPin, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

interface LocationPermissionPromptProps {
  onGranted: (position: GeolocationPosition) => void;
  onDismiss: () => void;
}

const LocationPermissionPrompt = ({ onGranted, onDismiss }: LocationPermissionPromptProps) => {
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestLocation = async () => {
    setRequesting(true);
    setError(null);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        })
      );
      onGranted(pos);
    } catch (err: any) {
      if (err.code === 1) {
        setError("Location access was denied. Please enable it in your device settings.");
      } else {
        setError("Unable to get your location. Please try again.");
      }
    } finally {
      setRequesting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-3"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <MapPin className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">Enable location access</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              We need your location to find nearby drivers and calculate accurate pickup times.
            </p>
          </div>
        </div>
        <button onClick={onDismiss} className="shrink-0 p-1 text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="text-xs text-destructive"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      <Button
        size="sm"
        className="w-full rounded-xl h-11"
        onClick={requestLocation}
        disabled={requesting}
      >
        {requesting ? "Requesting…" : "Allow location access"}
      </Button>
    </motion.div>
  );
};

export default LocationPermissionPrompt;
