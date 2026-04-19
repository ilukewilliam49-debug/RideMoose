import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Car, CheckCircle2, AlertCircle, Star, Phone } from "lucide-react";
import RideMap, { type MapMarker } from "@/components/map/MapContainer";
import { toast } from "sonner";

interface TrackData {
  status: string;
  service_type: string;
  pickup_address: string;
  pickup_lat: number | null;
  pickup_lng: number | null;
  dropoff_address: string;
  dropoff_lat: number | null;
  dropoff_lng: number | null;
  guest_name: string | null;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  driver: {
    name: string;
    vehicle: string | null;
    license_plate: string | null;
    rating: number | null;
    lat: number | null;
    lng: number | null;
  } | null;
  eta_min: number | null;
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  requested: { label: "Looking for a driver", color: "text-amber-500" },
  dispatched: { label: "Notifying drivers", color: "text-amber-500" },
  accepted: { label: "Driver on the way", color: "text-blue-500" },
  arrived: { label: "Driver has arrived", color: "text-emerald-500" },
  in_progress: { label: "On the trip", color: "text-emerald-500" },
  completed: { label: "Trip complete", color: "text-emerald-500" },
  cancelled: { label: "Trip cancelled", color: "text-destructive" },
};

export default function GuestTrack() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<TrackData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [calling, setCalling] = useState(false);

  const handleCallDriver = async () => {
    if (!token || calling) return;
    setCalling(true);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/guest-call-driver`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ token }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Could not place call");
      toast.success("We're calling your phone now to connect you with the driver.");
    } catch (e: any) {
      toast.error(e.message || "Couldn't place the call");
    } finally {
      setCalling(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    const fetchData = async () => {
      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/guest-track?token=${encodeURIComponent(token)}`;
        const res = await fetch(url, {
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Could not load trip");
        }
        const json = await res.json();
        if (!cancelled) {
          setData(json);
          setError(null);
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message || "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 10_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="p-6 max-w-sm w-full text-center space-y-3">
          <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
          <h1 className="text-lg font-semibold">Trip not found</h1>
          <p className="text-sm text-muted-foreground">
            This tracking link may be invalid or the trip may have ended.
          </p>
        </Card>
      </div>
    );
  }

  const statusInfo = STATUS_LABEL[data.status] || { label: data.status, color: "text-muted-foreground" };
  const isFinal = data.status === "completed" || data.status === "cancelled";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-lg font-bold tracking-tight">PickYou</h1>
          <span className="text-xs text-muted-foreground">Live tracking</span>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6 space-y-4">
        {data.guest_name && (
          <p className="text-sm text-muted-foreground">
            Hi {data.guest_name.split(" ")[0]}, here's the latest on your trip.
          </p>
        )}

        <Card className="p-5 space-y-3">
          <div className="flex items-center gap-3">
            {data.status === "completed" ? (
              <CheckCircle2 className="h-6 w-6 text-emerald-500" />
            ) : (
              <Car className={`h-6 w-6 ${statusInfo.color}`} />
            )}
            <div>
              <p className={`text-base font-semibold ${statusInfo.color}`}>
                {statusInfo.label}
              </p>
              {data.status === "accepted" && (
                <p className="text-xs text-muted-foreground">
                  {data.eta_min != null
                    ? `Arriving in ${data.eta_min} min`
                    : "Heading to your pickup"}
                </p>
              )}
            </div>
          </div>

          {data.driver && !isFinal && (
            <div className="rounded-xl bg-muted/40 p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{data.driver.name}</p>
                {data.driver.rating != null && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    {Number(data.driver.rating).toFixed(1)}
                  </span>
                )}
              </div>
              {data.driver.vehicle && (
                <p className="text-xs text-muted-foreground">{data.driver.vehicle}</p>
              )}
              {data.driver.license_plate && (
                <p className="text-xs font-mono tracking-wider bg-background border border-border rounded px-2 py-1 inline-block">
                  {data.driver.license_plate}
                </p>
              )}
              <Button
                onClick={handleCallDriver}
                disabled={calling}
                size="sm"
                className="w-full mt-2"
              >
                {calling ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Phone className="h-4 w-4 mr-2" />
                    Call driver
                  </>
                )}
              </Button>
              <p className="text-[10px] text-muted-foreground text-center">
                We'll call your phone and connect you. Your number stays private.
              </p>
            </div>
          )}
        </Card>

        {(() => {
          const markers: MapMarker[] = [];
          if (data.pickup_lat != null && data.pickup_lng != null) {
            markers.push({ lat: data.pickup_lat, lng: data.pickup_lng, type: "pickup", label: "Pickup" });
          }
          if (data.dropoff_lat != null && data.dropoff_lng != null) {
            markers.push({ lat: data.dropoff_lat, lng: data.dropoff_lng, type: "dropoff", label: "Dropoff" });
          }
          if (!isFinal && data.driver?.lat != null && data.driver?.lng != null) {
            markers.push({ lat: data.driver.lat, lng: data.driver.lng, type: "driver", label: data.driver.name });
          }
          if (markers.length === 0) return null;
          return (
            <Card className="p-2 overflow-hidden">
              <RideMap markers={markers} />
              {!isFinal && data.driver?.lat == null && (
                <p className="text-[11px] text-center text-muted-foreground py-2">
                  Driver location will appear once they're on the way.
                </p>
              )}
            </Card>
          );
        })()}

        <Card className="p-5 space-y-3">
          <div className="flex gap-3">
            <div className="flex flex-col items-center pt-1">
              <div className="h-2 w-2 rounded-full bg-emerald-500" />
              <div className="w-px flex-1 bg-border my-1" />
              <div className="h-2 w-2 rounded-full bg-destructive" />
            </div>
            <div className="flex-1 space-y-3 min-w-0">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Pickup</p>
                <p className="text-sm break-words">{data.pickup_address}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Dropoff</p>
                <p className="text-sm break-words">{data.dropoff_address}</p>
              </div>
            </div>
          </div>
        </Card>

        <p className="text-[11px] text-center text-muted-foreground pt-4">
          This page updates automatically. No account required.
        </p>
      </main>
    </div>
  );
}
