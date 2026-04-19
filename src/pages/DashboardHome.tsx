import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";
import { Car, Package, Plane, Clock, MapPin, Home as HomeIcon, Building2, ChevronRight, HelpCircle, LocateFixed, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AddressAutocomplete from "@/components/map/AddressAutocomplete";
import ActiveRideBanner from "@/components/rider/ActiveRideBanner";
import ErrorRetry from "@/components/driver/ErrorRetry";
import SupportChatDialog from "@/components/SupportChatDialog";
import NearbyDriversMap from "@/components/rider/NearbyDriversMap";
import PlanRideSheet from "@/components/rider/PlanRideSheet";
import PickupTimeSelector from "@/components/rider/PickupTimeSelector";
import RiderSelector from "@/components/rider/RiderSelector";
import { useRideBooking } from "@/contexts/RideBookingContext";



const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
};

const OutstandingBalanceBanner = ({ profileId, navigate }: { profileId?: string; navigate: (path: string) => void }) => {
  const { t } = useTranslation();
  const { data: outstandingRide } = useQuery({
    queryKey: ["home-outstanding", profileId],
    queryFn: async () => {
      if (!profileId) return null;
      const { data } = await supabase
        .from("rides")
        .select("id, outstanding_amount_cents")
        .eq("rider_id", profileId)
        .eq("payment_status", "partial")
        .gt("outstanding_amount_cents", 0)
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!profileId,
  });
  if (!outstandingRide) return null;
  return (
    <button
      onClick={() => navigate("/rider/rides")}
      className="flex w-full items-center gap-3 rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-3 mb-4 text-left"
    >
      <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-yellow-600">{t("rider.outstandingBalance", "Outstanding balance")}</p>
        <p className="text-xs text-muted-foreground">
          ${((outstandingRide.outstanding_amount_cents || 0) / 100).toFixed(2)} {t("rider.duePayNow", "due — tap to pay")}
        </p>
      </div>
      <ChevronRight className="h-4 w-4 text-yellow-500/60 shrink-0" />
    </button>
  );
};

const DashboardHome = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  
  const [destination, setDestination] = useState("");
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
  const [customDate, setCustomDate] = useState<Date | undefined>(undefined);
  const [customTime, setCustomTime] = useState("12:00");
  const [showCustom, setShowCustom] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [pickupAddress, setPickupAddress] = useState("");
  const [pickupAddressCoords, setPickupAddressCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [dropoffAddressCoords, setDropoffAddressCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [planSheetOpen, setPlanSheetOpen] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude, longitude } = pos.coords;
          setUserLocation({ lat: latitude, lng: longitude });
          setPickupAddressCoords({ lat: latitude, lng: longitude });
          // Auto-fill pickup address via reverse-geocode
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
            const geo = await res.json();
            if (geo.display_name) setPickupAddress(geo.display_name);
          } catch { /* silent */ }
        },
        () => {}
      );
    }
  }, []);

  const scheduleLabel = scheduledAt
    ? format(scheduledAt, "MMM d, h:mm a")
    : t("dashboard.now");

  const handlePreset = (mins: number) => {
    setScheduledAt(addMinutes(new Date(), mins));
    setShowCustom(false);
    setScheduleOpen(false);
  };

  const handleNow = () => {
    setScheduledAt(null);
    setShowCustom(false);
    setScheduleOpen(false);
  };

  const handleCustomConfirm = () => {
    if (!customDate) return;
    const [h, m] = customTime.split(":").map(Number);
    const dt = new Date(customDate);
    dt.setHours(h, m, 0, 0);
    setScheduledAt(dt);
    setShowCustom(false);
    setScheduleOpen(false);
  };

  const withSchedule = (path: string) => {
    if (!scheduledAt) return path;
    const sep = path.includes("?") ? "&" : "?";
    return `${path}${sep}scheduledAt=${scheduledAt.toISOString()}`;
  };

  // Fetch saved places
  const { data: savedPlaces, isLoading: savedPlacesLoading, isError: savedPlacesError, refetch: refetchSaved } = useQuery({
    queryKey: ["saved-places", profile?.user_id],
    queryFn: async () => {
      if (!profile?.user_id) return [];
      const { data, error } = await supabase
        .from("saved_places")
        .select("*")
        .eq("user_id", profile.user_id)
        .order("sort_order", { ascending: true })
        .limit(3);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!profile?.user_id,
  });

  // Recent destinations from ride history
  const { data: recentDestinations } = useQuery({
    queryKey: ["recent-destinations", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data, error } = await supabase
        .from("rides")
        .select("dropoff_address, dropoff_lat, dropoff_lng")
        .eq("rider_id", profile.id)
        .in("status", ["completed", "in_progress"])
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) return [];
      // Deduplicate by address
      const seen = new Set<string>();
      const unique: typeof data = [];
      for (const r of data ?? []) {
        if (!seen.has(r.dropoff_address)) {
          seen.add(r.dropoff_address);
          unique.push(r);
        }
        if (unique.length >= 3) break;
      }
      return unique;
    },
    enabled: !!profile?.id,
  });

  const suggestions = [
    { icon: Car, label: t("dashboard.localTaxi"), basePath: "/rider/rides", service: "taxi" },
    { icon: Plane, label: t("dashboard.airportRides"), basePath: "/rider/rides", service: "private_hire" },
    { icon: Package, label: t("dashboard.delivery"), basePath: "/rider/courier", service: "courier" },
  ];

  const placeIcon = (icon: string) => {
    if (icon === "home") return HomeIcon;
    if (icon === "work" || icon === "briefcase") return Building2;
    return MapPin;
  };

  const firstName = profile?.full_name?.split(" ")[0] || "";

  return (
    <div className="pb-8">
      {/* ── Greeting ── */}
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4"
      >
        <h1 className="text-xl font-black tracking-tight">
          {getGreeting()}{firstName ? `, ${firstName}` : ""} 👋
        </h1>
      </motion.div>

      {/* ── Active ride banner ── */}
      <div className="mb-4">
        <ActiveRideBanner />
      </div>

      {/* ── Outstanding balance banner ── */}
      <OutstandingBalanceBanner profileId={profile?.id} navigate={navigate} />


      {/* ── Hero: Get-a-ride form + Yellowknife map (Uber-style) ── */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:items-start">
        {/* Mobile-only: "Where to?" trigger above the map (opens PlanRideSheet) */}
        <div className="order-1 lg:hidden">
          <button
            type="button"
            onClick={() => setPlanSheetOpen(true)}
            className="flex w-full items-center gap-2 rounded-2xl bg-card p-4 text-left active:scale-[0.99] transition-transform"
            style={{ boxShadow: "0 1px 4px 0 hsl(0 0% 0%/0.15)" }}
          >
            <div className="flex h-6 w-6 shrink-0 items-center justify-center">
              <div className="h-2.5 w-2.5 rounded-sm bg-primary ring-2 ring-primary/20" />
            </div>
            <span className="flex-1 text-[14px] font-semibold text-muted-foreground">
              {t("dashboard.whereTo", "Where to?")}
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
          </button>
        </div>

        {/* Map (below "Where to?" on mobile, right on desktop) */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="order-2 lg:order-2"
          ref={mapRef}
        >
          <NearbyDriversMap
            activeTab="taxi"
            userLocation={userLocation}
            height="clamp(280px, 42vh, 560px)"
            className=""
          />
        </motion.div>


        {/* Get-a-ride card (desktop only — mobile uses PlanRideSheet trigger) */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="hidden lg:block order-3 lg:order-1 rounded-2xl bg-card p-4 lg:p-5 lg:sticky lg:top-4"
          style={{ boxShadow: "0 1px 4px 0 hsl(0 0% 0%/0.15)" }}
        >
          <h2 className="hidden lg:block text-base font-black tracking-tight mb-3">
            {t("dashboard.getARide", "Get a ride")}
          </h2>

          <div className="space-y-2">
            {/* Pickup — desktop only (mobile shows it above the map) */}
            <div className="hidden lg:flex items-center gap-2">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center">
                <div className="h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-green-500/20" />
              </div>
              <div className="flex-1 [&_svg.absolute]:hidden [&_input]:border-0 [&_input]:bg-transparent [&_input]:shadow-none [&_input]:focus-visible:ring-0 [&_input]:focus-visible:ring-offset-0 [&_input]:text-[14px] [&_input]:font-semibold [&_input]:placeholder:text-muted-foreground [&_input]:h-9 [&_input]:px-0 [&_input]:pl-0">
                <AddressAutocomplete
                  value={pickupAddress}
                  onChange={(value, lat, lng) => {
                    setPickupAddress(value);
                    if (lat && lng) setPickupAddressCoords({ lat, lng });
                  }}
                  placeholder={t("rider.pickupLocation", "Pickup location")}
                  iconColor="text-green-400"
                />
              </div>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
                      navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 })
                    );
                    const { latitude, longitude } = pos.coords;
                    setPickupAddressCoords({ lat: latitude, lng: longitude });
                    setUserLocation({ lat: latitude, lng: longitude });
                    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
                    const geo = await res.json();
                    setPickupAddress(geo.display_name || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
                  } catch {}
                }}
                className="shrink-0 text-primary hover:text-primary/80 transition-colors"
                aria-label="Use my location"
              >
                <LocateFixed className="h-4 w-4" />
              </button>
            </div>

            <div className="hidden lg:block ml-3 h-3 border-l-2 border-dashed border-border/50" />

            {/* Dropoff */}
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center">
                <div className="h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-primary/20" />
              </div>
              <div className="flex-1 [&_svg.absolute]:hidden [&_input]:border-0 [&_input]:bg-transparent [&_input]:shadow-none [&_input]:focus-visible:ring-0 [&_input]:focus-visible:ring-offset-0 [&_input]:text-[14px] [&_input]:font-semibold [&_input]:placeholder:text-muted-foreground [&_input]:h-9 [&_input]:px-0 [&_input]:pl-0">
                <AddressAutocomplete
                  value={destination}
                  onChange={(value, lat, lng) => {
                    setDestination(value);
                    if (lat && lng) setDropoffAddressCoords({ lat, lng });
                  }}
                  placeholder={t("dashboard.whereTo")}
                  iconColor="text-primary"
                />
              </div>
            </div>

            {/* Schedule + Go button row */}
            <div className="flex items-center gap-2 pt-2">
              <Popover open={scheduleOpen} onOpenChange={setScheduleOpen}>
                <PopoverTrigger asChild>
                  <button className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 shrink-0 hover:bg-accent transition-colors">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-semibold max-w-[100px] truncate">{scheduleLabel}</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-3" align="start">
                  {!showCustom ? (
                    <div className="space-y-1">
                      <button onClick={handleNow} className={cn("w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors", !scheduledAt ? "bg-primary/10 text-primary" : "hover:bg-accent")}>
                        Now
                      </button>
                      {[{ m: 15, label: "In 15 mins" }, { m: 30, label: "In 30 mins" }, { m: 60, label: "In 1 hour" }].map(({ m, label }) => (
                        <button key={m} onClick={() => handlePreset(m)} className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-accent transition-colors">
                          {label}
                        </button>
                      ))}
                      <button onClick={() => setShowCustom(true)} className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-accent transition-colors flex items-center gap-2">
                        <CalendarIcon className="h-3.5 w-3.5" />
                        Custom date &amp; time
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <Calendar
                        mode="single"
                        selected={customDate}
                        onSelect={setCustomDate}
                        disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))}
                        className={cn("p-2 pointer-events-auto")}
                      />
                      <div className="flex items-center gap-2">
                        <Input
                          type="time"
                          value={customTime}
                          onChange={(e) => setCustomTime(e.target.value)}
                          className="flex-1"
                        />
                        <Button size="sm" onClick={handleCustomConfirm} disabled={!customDate}>
                          Set
                        </Button>
                      </div>
                      <button onClick={() => setShowCustom(false)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                        ← Back
                      </button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>

              <Button
                size="sm"
                className="ml-auto rounded-full px-5"
                disabled={!destination}
                onClick={() => {
                  const base = "/rider/rides";
                  let params = "";
                  if (pickupAddress && pickupAddressCoords) {
                    params += `?pickup=${encodeURIComponent(pickupAddress)}&plat=${pickupAddressCoords.lat}&plng=${pickupAddressCoords.lng}`;
                  }
                  if (destination && dropoffAddressCoords) {
                    const sep2 = params ? "&" : "?";
                    params += `${sep2}dropoff=${encodeURIComponent(destination)}&dlat=${dropoffAddressCoords.lat}&dlng=${dropoffAddressCoords.lng}`;
                  }
                  navigate(withSchedule(`${base}${params}`));
                }}
              >
                {t("dashboard.go", "Go")} <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── Saved places ── */}
      {savedPlacesLoading && (
        <div className="mt-4 space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="flex items-center gap-4 py-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          ))}
        </div>
      )}

      {savedPlacesError && (
        <div className="mt-4">
          <ErrorRetry message="Failed to load saved places" onRetry={() => refetchSaved()} />
        </div>
      )}

      {savedPlaces && savedPlaces.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.3 }}
          className="mt-4 divide-y divide-border/30"
        >
          {savedPlaces.map((place) => {
            const Icon = placeIcon(place.icon);
            return (
              <button
                key={place.id}
                onClick={async () => {
                  try {
                    const res = await fetch(
                      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(place.address)}&format=json&limit=1`
                    );
                    const results = await res.json();
                    const lat = results?.[0]?.lat;
                    const lng = results?.[0]?.lon;
                    const coordParams = lat && lng ? `&dlat=${lat}&dlng=${lng}` : "";
                    navigate(
                      withSchedule(`/rider/rides?dropoff=${encodeURIComponent(place.address)}${coordParams}`)
                    );
                  } catch {
                    navigate(
                      withSchedule(`/rider/rides?dropoff=${encodeURIComponent(place.address)}`)
                    );
                  }
                }}
                className="flex w-full items-center gap-4 py-3.5 text-left hover:bg-accent/30 transition-colors -mx-1 px-1 rounded-lg"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary">
                  <Icon className="h-4 w-4 text-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-semibold leading-tight">{place.label}</p>
                  <p className="text-[13px] text-muted-foreground truncate mt-0.5">{place.address}</p>
                </div>
              </button>
            );
          })}
        </motion.div>
      )}

      {/* ── Recent destinations ── */}
      {recentDestinations && recentDestinations.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.12, duration: 0.3 }}
          className="mt-2 divide-y divide-border/30"
        >
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pb-2 pt-1">
            {t("dashboard.recent", "Recent")}
          </p>
          {recentDestinations.map((rd, i) => (
            <button
              key={i}
              onClick={() => {
                const base = "/rider/rides";
                const params = rd.dropoff_lat && rd.dropoff_lng
                  ? `?dropoff=${encodeURIComponent(rd.dropoff_address)}&dlat=${rd.dropoff_lat}&dlng=${rd.dropoff_lng}`
                  : `?dropoff=${encodeURIComponent(rd.dropoff_address)}`;
                navigate(withSchedule(`${base}${params}`));
              }}
              className="flex w-full items-center gap-4 py-3 text-left hover:bg-accent/30 transition-colors -mx-1 px-1 rounded-lg"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <p className="text-[13px] text-muted-foreground truncate flex-1">{rd.dropoff_address}</p>
            </button>
          ))}
        </motion.div>
      )}

      {/* ── Divider ── */}
      <div className="my-5 h-px bg-border/30" />

      {/* ── Suggestions ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.3 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-black tracking-tight">{t("dashboard.suggestions")}</h2>
          <button
            onClick={() => {
              if (!destination) {
                setPlanSheetOpen(true);
                return;
              }
              navigate(withSchedule("/rider/rides"));
            }}
            className="text-[13px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            {t("dashboard.seeAll")}
          </button>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
          {suggestions.map((item) => (
            <button
              key={item.label}
              onClick={() => {
                if (!destination) {
                  setPlanSheetOpen(true);
                  return;
                }
                const params = new URLSearchParams();
                params.set("service", item.service);
                if (pickupAddress && pickupAddressCoords) {
                  params.set("pickup", pickupAddress);
                  params.set("plat", String(pickupAddressCoords.lat));
                  params.set("plng", String(pickupAddressCoords.lng));
                }
                if (destination && dropoffAddressCoords) {
                  params.set("dropoff", destination);
                  params.set("dlat", String(dropoffAddressCoords.lat));
                  params.set("dlng", String(dropoffAddressCoords.lng));
                }
                navigate(withSchedule(`${item.basePath}?${params.toString()}`));
              }}
              className="flex flex-col items-center gap-2 shrink-0 active:scale-[0.96] transition-transform"
            >
              <div className="flex h-[72px] w-[72px] items-center justify-center rounded-2xl bg-card border border-border/30">
                <item.icon className="h-7 w-7 text-primary" />
              </div>
              <span className="text-[12px] font-semibold text-center leading-tight max-w-[76px]">
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </motion.div>

      {/* ── Divider ── */}
      <div className="my-6 h-px bg-border/30" />

      {/* ── Quick access cards ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.3 }}
        className="space-y-3"
      >
        <h2 className="text-lg font-black tracking-tight">{t("dashboard.quickActions")}</h2>

        {(() => {
          // Build query string from typed pickup/destination so the booking page
          // pre-fills the addresses instead of starting blank.
          const buildBookingUrl = (basePath: string, extraParams?: Record<string, string>) => {
            const params = new URLSearchParams();
            if (extraParams) {
              Object.entries(extraParams).forEach(([k, v]) => params.set(k, v));
            }
            if (pickupAddress && pickupAddressCoords) {
              params.set("pickup", pickupAddress);
              params.set("plat", String(pickupAddressCoords.lat));
              params.set("plng", String(pickupAddressCoords.lng));
            }
            if (destination && dropoffAddressCoords) {
              params.set("dropoff", destination);
              params.set("dlat", String(dropoffAddressCoords.lat));
              params.set("dlng", String(dropoffAddressCoords.lng));
            }
            const qs = params.toString();
            return `${basePath}${qs ? `?${qs}` : ""}`;
          };

          const needsAddresses = !destination;
          const handleQuickAction = (basePath: string, extraParams?: Record<string, string>) => {
            if (needsAddresses) {
              setPlanSheetOpen(true);
              return;
            }
            navigate(withSchedule(buildBookingUrl(basePath, extraParams)));
          };

          return (
            <>
              <button
                onClick={() => handleQuickAction("/rider/rides")}
                className="flex w-full items-center gap-4 rounded-2xl bg-card/60 p-4 text-left hover:bg-card transition-colors active:scale-[0.99]"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <Car className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-bold">{t("rider.requestARide")}</p>
                  <p className="text-[13px] text-muted-foreground mt-0.5">
                    {needsAddresses
                      ? t("dashboard.enterAddressesFirst", "Enter pickup & destination first")
                      : t("dashboard.ridesDesc")}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
              </button>

              <button
                onClick={() => handleQuickAction("/rider/courier", { service: "courier" })}
                className="flex w-full items-center gap-4 rounded-2xl bg-card/60 p-4 text-left hover:bg-card transition-colors active:scale-[0.99]"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <Package className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-bold">{t("dashboard.delivery")}</p>
                  <p className="text-[13px] text-muted-foreground mt-0.5">
                    {needsAddresses
                      ? t("dashboard.enterAddressesFirst", "Enter pickup & destination first")
                      : t("dashboard.deliveryDesc")}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
              </button>
            </>
          );
        })()}

        {/* Help / Support */}
        <SupportChatDialog
          trigger={
            <button className="flex w-full items-center gap-4 rounded-2xl bg-card/60 p-4 text-left hover:bg-card transition-colors active:scale-[0.99]">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <HelpCircle className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-bold">{t("nav.support", "Help & Support")}</p>
                <p className="text-[13px] text-muted-foreground mt-0.5">{t("dashboard.supportDesc", "Get help with your rides")}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
            </button>
          }
        />
      </motion.div>

      {/* Mobile-only: full-screen "Plan your ride" sheet */}
      <PlanRideSheet
        open={planSheetOpen}
        onOpenChange={setPlanSheetOpen}
        pickupAddress={pickupAddress}
        setPickupAddress={setPickupAddress}
        pickupCoords={pickupAddressCoords}
        setPickupCoords={setPickupAddressCoords}
        destination={destination}
        setDestination={setDestination}
        dropoffCoords={dropoffAddressCoords}
        setDropoffCoords={setDropoffAddressCoords}
        scheduledAt={scheduledAt}
        setScheduledAt={setScheduledAt}
        setUserLocation={setUserLocation}
        savedPlaces={savedPlaces ?? []}
        onRequestMapPick={() => {
          setTimeout(() => mapRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
        }}
      />
    </div>
  );
};

export default DashboardHome;
