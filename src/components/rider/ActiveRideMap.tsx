import { motion } from "framer-motion";
import { MapPinned, Clock, AlertTriangle } from "lucide-react";
import RideMap, { type MapMarker } from "@/components/map/MapContainer";
import { useTranslation } from "react-i18next";

interface ActiveRideMapProps {
  markers: MapMarker[];
  polyline: string | null;
  liveEta: { distance_km: number; duration_text: string; duration_in_traffic_text: string } | null;
  activeRideDirections: { distance_km: number; duration_text: string; duration_in_traffic_text: string } | null;
  activeTrafficDelayMin: number;
  activeRideStatus?: string;
}

const ActiveRideMap = ({ markers, polyline, liveEta, activeRideDirections, activeTrafficDelayMin, activeRideStatus }: ActiveRideMapProps) => {
  const { t } = useTranslation();
  const etaData = liveEta || activeRideDirections;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <RideMap markers={markers} polyline={polyline} />
      {etaData && (
        <div className="glass-surface rounded-lg p-3 mt-2 flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <MapPinned className="h-4 w-4 text-primary" />
            <span className="font-medium text-foreground">{(liveEta?.distance_km ?? activeRideDirections?.distance_km ?? 0).toFixed(1)} km</span>
            {liveEta && <span className="text-[10px] text-muted-foreground">({activeRideStatus === "in_progress" ? t("rider.toDropoff") : t("rider.toPickup")})</span>}
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="h-4 w-4 text-primary" />
            <span className="font-medium text-foreground">{liveEta ? (liveEta.duration_in_traffic_text || liveEta.duration_text) : (activeRideDirections?.duration_in_traffic_text || activeRideDirections?.duration_text)}</span>
            {liveEta && <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span></span>}
          </div>
          {activeTrafficDelayMin > 2 && (
            <div className="flex items-center gap-1.5 text-amber-500">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-xs font-medium">+{Math.round(activeTrafficDelayMin)} min traffic</span>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default ActiveRideMap;
