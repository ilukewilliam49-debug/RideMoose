import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Check, MapPin, Car, Bus, Briefcase, Banknote, Package, AlertTriangle, ShoppingBag, Truck, Weight, Receipt } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import RideMap, { type MapMarker } from "@/components/map/MapContainer";
import { useDriverLocation } from "@/hooks/useDriverLocation";
import TaxiMeter from "@/components/TaxiMeter";
import DriverBidForm from "@/components/DriverBidForm";

const DriverDispatch = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [uploadingProof, setUploadingProof] = useState(false);
  const proofInputRef = useRef<HTMLInputElement>(null);

  useDriverLocation(profile?.id, !!profile?.is_available);

  // Only fetch rides matching driver's capabilities
  const { data: pendingRides } = useQuery({
    queryKey: ["dispatch-rides", profile?.can_taxi, profile?.can_private_hire, profile?.can_shuttle, profile?.can_courier, profile?.vehicle_type],
    queryFn: async () => {
      const serviceTypes: ("taxi" | "private_hire" | "shuttle" | "courier" | "large_delivery")[] = [];
      if (profile?.can_taxi) serviceTypes.push("taxi");
      if (profile?.can_private_hire) serviceTypes.push("private_hire");
      if (profile?.can_shuttle) serviceTypes.push("shuttle");
      if (profile?.can_courier) serviceTypes.push("courier");
      // large_delivery eligibility is based on vehicle_type
      if (profile?.vehicle_type && ["SUV", "truck", "van"].includes(profile.vehicle_type)) serviceTypes.push("large_delivery");
      if (serviceTypes.length === 0) return [];

      const { data, error } = await supabase
        .from("rides")
        .select("*")
        .in("status", ["requested", "dispatched"])
        .in("service_type", serviceTypes)
        .order("created_at", { ascending: true })
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!profile,
    refetchInterval: 5000,
  });

  const { data: activeRide } = useQuery({
    queryKey: ["active-ride", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;
      const { data, error } = await supabase
        .from("rides")
        .select("*")
        .eq("driver_id", profile.id)
        .in("status", ["accepted", "in_progress"])
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!profile?.id,
  });

  // Fetch driver's existing bids on pending large_delivery rides
  const { data: myBids } = useQuery({
    queryKey: ["my-delivery-bids", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data, error } = await supabase
        .from("delivery_bids")
        .select("*")
        .eq("driver_id", profile.id)
        .in("status", ["pending", "accepted", "rejected"]);
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.id,
    refetchInterval: 5000,
  });

  const bidsByRide = new Map<string, any>();
  myBids?.forEach((b: any) => { bidsByRide.set(b.ride_id, b); });

  // Rides with outstanding balance (partial in-app or pay_driver unpaid)
  const { data: outstandingRides } = useQuery({
    queryKey: ["outstanding-rides", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data, error } = await supabase
        .from("rides")
        .select("*")
        .eq("driver_id", profile.id)
        .eq("status", "completed")
        .or("payment_status.eq.partial,and(payment_option.eq.pay_driver,payment_status.eq.unpaid)")
        .order("completed_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.id,
  });

  const { data: recentDeliveries } = useQuery({
    queryKey: ["recent-deliveries", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data, error } = await supabase
        .from("rides")
        .select("*")
        .eq("driver_id", profile.id)
        .eq("status", "completed")
        .in("service_type", ["large_delivery", "courier"])
        .order("completed_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.id,
  });

  useEffect(() => {
    const channel = supabase
      .channel("rides-dispatch")
      .on("postgres_changes", { event: "*", schema: "public", table: "rides" }, () => {
        queryClient.invalidateQueries({ queryKey: ["dispatch-rides"] });
        queryClient.invalidateQueries({ queryKey: ["active-ride"] });
        queryClient.invalidateQueries({ queryKey: ["outstanding-rides"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "delivery_bids" }, () => {
        queryClient.invalidateQueries({ queryKey: ["my-delivery-bids"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const acceptRide = async (rideId: string) => {
    if (!profile?.id) return;
    const { error } = await supabase
      .from("rides")
      .update({ driver_id: profile.id, status: "accepted" })
      .eq("id", rideId)
      .eq("status", "requested");
    if (error) {
      toast.error("Could not accept ride. It may have been taken.");
    } else {
      toast.success("Ride accepted!");
    }
  };

  const markOutstandingCollected = async (rideId: string, hasCaptured: boolean) => {
    const { error } = await supabase
      .from("rides")
      .update({
        outstanding_amount_cents: 0,
        driver_collected_outstanding_at: new Date().toISOString(),
        payment_status: "paid",
        paid_at: new Date().toISOString(),
      })
      .eq("id", rideId);
    if (error) toast.error(error.message);
    else {
      toast.success("Marked as collected!");
      queryClient.invalidateQueries({ queryKey: ["outstanding-rides"] });
    }
  };
  const uploadProofPhoto = async (rideId: string, file: File) => {
    setUploadingProof(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${rideId}/proof.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("proof-photos")
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("proof-photos")
        .getPublicUrl(path);

      const { error: updateError } = await supabase
        .from("rides")
        .update({ proof_photo_url: urlData.publicUrl } as any)
        .eq("id", rideId);
      if (updateError) throw updateError;

      toast.success("Proof photo uploaded!");
      queryClient.invalidateQueries({ queryKey: ["active-ride"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploadingProof(false);
    }
  };

  const updateRideStatus = async (rideId: string, status: string) => {
    const updates: any = { status };
    if (status === "in_progress") updates.started_at = new Date().toISOString();
    if (status === "completed") updates.completed_at = new Date().toISOString();
    const { error } = await supabase.from("rides").update(updates).eq("id", rideId);
    if (error) {
      toast.error(error.message);
      return;
    }

    // Capture payment for completed large_delivery rides
    if (status === "completed" && activeRide?.service_type === "large_delivery" && activeRide?.payment_status === "authorized") {
      try {
        const { error: captureErr } = await supabase.functions.invoke("capture-payment", {
          body: { ride_id: rideId },
        });
        if (captureErr) console.error("Capture error:", captureErr);
      } catch (e) {
        console.error("Payment capture failed:", e);
      }
    }

    toast.success(`Ride ${status.replace("_", " ")}!`);
  };

  const activeMarkers: MapMarker[] = activeRide
    ? [
        ...(activeRide.pickup_lat && activeRide.pickup_lng ? [{ lat: activeRide.pickup_lat, lng: activeRide.pickup_lng, type: "pickup" as const, label: "Pickup" }] : []),
        ...(activeRide.dropoff_lat && activeRide.dropoff_lng ? [{ lat: activeRide.dropoff_lat, lng: activeRide.dropoff_lng, type: "dropoff" as const, label: "Dropoff" }] : []),
        ...(profile?.latitude && profile?.longitude ? [{ lat: profile.latitude, lng: profile.longitude, type: "driver" as const, label: "You" }] : []),
      ]
    : [];

  const pendingMarkers: MapMarker[] = (pendingRides || [])
    .filter((r) => r.pickup_lat && r.pickup_lng)
    .map((r) => ({
      lat: r.pickup_lat!,
      lng: r.pickup_lng!,
      type: "pickup" as const,
      label: r.pickup_address,
    }));

  const ServiceIcon = ({ type }: { type: string }) =>
    type === "shuttle" ? <Bus className="h-3.5 w-3.5" /> : type === "private_hire" ? <Briefcase className="h-3.5 w-3.5" /> : type === "courier" ? <Package className="h-3.5 w-3.5" /> : type === "large_delivery" ? <Truck className="h-3.5 w-3.5" /> : <Car className="h-3.5 w-3.5" />;

  return (
    <div className="space-y-6 pt-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dispatch Board</h1>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {profile?.can_taxi && <span className="flex items-center gap-1 px-2 py-1 rounded bg-secondary"><Car className="h-3 w-3" /> Taxi</span>}
          {profile?.can_private_hire && <span className="flex items-center gap-1 px-2 py-1 rounded bg-secondary"><Briefcase className="h-3 w-3" /> Private</span>}
          {profile?.can_shuttle && <span className="flex items-center gap-1 px-2 py-1 rounded bg-secondary"><Bus className="h-3 w-3" /> Shuttle</span>}
          {profile?.can_courier && <span className="flex items-center gap-1 px-2 py-1 rounded bg-secondary"><Package className="h-3 w-3" /> Courier</span>}
          {profile?.vehicle_type && ["SUV", "truck", "van"].includes(profile.vehicle_type) && <span className="flex items-center gap-1 px-2 py-1 rounded bg-secondary"><Truck className="h-3 w-3" /> Large</span>}
        </div>
      </div>

      {/* Active ride with map */}
      {activeRide && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          {activeMarkers.length > 0 && <RideMap markers={activeMarkers} />}
          <div className="glass-surface rounded-lg p-5 border border-primary/30">
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-sm font-semibold text-primary">ACTIVE RIDE</h2>
              <span className="text-xs font-mono uppercase px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">
                {activeRide.service_type === "private_hire" ? "Private Hire – Flat Rate" : activeRide.service_type}
              </span>
            </div>
            <div className="space-y-2 mb-4">
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-green-400 mt-0.5" />
                <span className="text-sm">{activeRide.pickup_address}</span>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-primary mt-0.5" />
                <span className="text-sm">{activeRide.dropoff_address}</span>
              </div>
            </div>
            {/* Taxi rides use the meter */}
            {activeRide.service_type === "taxi" ? (
              <TaxiMeter rideId={activeRide.id} meterStatus={activeRide.meter_status} />
            ) : (
              <div className="space-y-3">
                {/* Courier: show package info and proof photo */}
                {activeRide.service_type === "courier" && (
                  <div className="space-y-2">
                    {(activeRide as any).item_description && (
                      <p className="text-xs text-muted-foreground">
                        📦 Item: <span className="font-medium text-foreground">{(activeRide as any).item_description}</span>
                      </p>
                    )}
                    {(activeRide as any).marketplace_delivery && (
                      <div className="flex items-center gap-1.5 text-xs text-yellow-500">
                        <ShoppingBag className="h-3.5 w-3.5" />
                        <span>Marketplace delivery — ensure vehicle capacity fits item</span>
                      </div>
                    )}
                    {(activeRide as any).package_size && (
                      <p className="text-xs text-muted-foreground">
                        Package: <span className="capitalize font-medium">{(activeRide as any).package_size}</span>
                      </p>
                    )}
                    {(activeRide as any).pickup_notes && (
                      <p className="text-xs text-muted-foreground">Pickup notes: {(activeRide as any).pickup_notes}</p>
                    )}
                    {(activeRide as any).dropoff_notes && (
                      <p className="text-xs text-muted-foreground">Dropoff notes: {(activeRide as any).dropoff_notes}</p>
                    )}
                    {activeRide.status === "in_progress" && (activeRide as any).proof_photo_required && !(activeRide as any).proof_photo_url && (
                      <div className="p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5">
                        <p className="text-xs text-yellow-500 font-medium mb-2">📸 Proof photo required before completing</p>
                        <input
                          ref={proofInputRef}
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) uploadProofPhoto(activeRide.id, file);
                          }}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={uploadingProof}
                          onClick={() => proofInputRef.current?.click()}
                        >
                          {uploadingProof ? "Uploading..." : "Upload Proof Photo"}
                        </Button>
                      </div>
                    )}
                    {(activeRide as any).proof_photo_url && (
                      <p className="text-xs text-green-500">✓ Proof photo uploaded</p>
                    )}
                  </div>
                )}
                {/* Large Delivery: show item details */}
                {activeRide.service_type === "large_delivery" && (
                  <div className="space-y-2">
                    {(activeRide as any).item_description && (
                      <p className="text-xs text-muted-foreground">
                        📦 Item: <span className="font-medium text-foreground">{(activeRide as any).item_description}</span>
                      </p>
                    )}
                    {(activeRide as any).weight_estimate_kg && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Weight className="h-3 w-3" /> ~{(activeRide as any).weight_estimate_kg} kg
                      </p>
                    )}
                    {(activeRide as any).requires_loading_help && (
                      <p className="text-xs text-yellow-500">⚠ Loading help required</p>
                    )}
                    {(activeRide as any).stairs_involved && (
                      <p className="text-xs text-yellow-500">⚠ Stairs involved</p>
                    )}
                    {(activeRide as any).pickup_notes && (
                      <p className="text-xs text-muted-foreground">Pickup notes: {(activeRide as any).pickup_notes}</p>
                    )}
                    {(activeRide as any).dropoff_notes && (
                      <p className="text-xs text-muted-foreground">Dropoff notes: {(activeRide as any).dropoff_notes}</p>
                    )}
                  </div>
                )}
                <div className="flex gap-2">
                  {activeRide.status === "accepted" && (
                    <Button size="sm" onClick={() => updateRideStatus(activeRide.id, "in_progress")}>
                      {activeRide.service_type === "courier" || activeRide.service_type === "large_delivery" ? "Start Delivery" : "Start Trip"}
                    </Button>
                  )}
                  {activeRide.status === "in_progress" && (
                    <Button
                      size="sm"
                      disabled={(activeRide.service_type === "courier" || activeRide.service_type === "large_delivery") && (activeRide as any).proof_photo_required && !(activeRide as any).proof_photo_url}
                      onClick={() => updateRideStatus(activeRide.id, "completed")}
                    >
                      {activeRide.service_type === "courier" || activeRide.service_type === "large_delivery" ? "Complete Delivery" : "Complete Trip"}
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => updateRideStatus(activeRide.id, "cancelled")}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Outstanding balance rides */}
      {outstandingRides && outstandingRides.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Banknote className="h-5 w-5 text-yellow-500" />
            Collect Remaining Balance
          </h2>
          <div className="space-y-2">
            {outstandingRides.map((ride) => {
              const totalFare = Number(ride.final_fare_cents || ride.final_price || 0);
              const captured = Number(ride.captured_amount_cents || 0);
              const outstanding = Number(ride.outstanding_amount_cents || 0);
              const displayOutstanding = outstanding > 0 ? outstanding : totalFare;
              return (
                <div key={ride.id} className="glass-surface rounded-lg p-4 space-y-2">
                  <p className="text-sm font-medium truncate">
                    {ride.pickup_address} → {ride.dropoff_address}
                  </p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
                    <span>Total: ${(totalFare / 100).toFixed(2)}</span>
                    {captured > 0 && <span>Paid in app: ${(captured / 100).toFixed(2)}</span>}
                    <span className="text-yellow-500 font-semibold">Due: ${(displayOutstanding / 100).toFixed(2)}</span>
                  </div>
                  {ride.outstanding_reason === "fare_exceeded_authorization" && (
                    <p className="text-[10px] text-yellow-500">Fare exceeded pre-authorization</p>
                  )}
                  <Button
                    size="sm"
                    className="w-full gap-1.5"
                    onClick={() => markOutstandingCollected(ride.id, captured > 0)}
                  >
                    <Banknote className="h-3.5 w-3.5" /> Mark Remaining Collected
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent completed large deliveries with earnings breakdown */}
      {recentDeliveries && recentDeliveries.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            Recent Deliveries
          </h2>
          <div className="space-y-2">
            {recentDeliveries.map((ride: any) => {
              const bidAmount = ride.final_fare_cents || 0;
              const commission = ride.commission_cents || 0;
              const stripeFee = ride.stripe_fee_cents || 0;
              const earnings = ride.driver_earnings_cents || 0;
              return (
                <div key={ride.id} className="glass-surface rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold shrink-0 ${ride.service_type === 'courier' ? 'bg-accent text-accent-foreground' : 'bg-primary/10 text-primary'}`}>
                        {ride.service_type === 'courier' ? 'Courier' : 'Large Delivery'}
                      </span>
                      <p className="text-sm font-medium truncate min-w-0">
                        {ride.pickup_address} → {ride.dropoff_address}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground ml-2 shrink-0">
                      {ride.completed_at ? new Date(ride.completed_at).toLocaleDateString() : ""}
                    </span>
                  </div>
                  <div className="text-[10px] font-mono text-muted-foreground border-t border-border pt-2 space-y-1">
                    <div className="flex justify-between">
                      <span>Bid Amount</span>
                      <span>${(bidAmount / 100).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Platform Commission (8%)</span>
                      <span className="text-destructive">-${(commission / 100).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Processing Fee</span>
                      <span className="text-destructive">-${(stripeFee / 100).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-xs text-primary pt-1 border-t border-border">
                      <span>Net Earnings</span>
                      <span>${(earnings / 100).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!activeRide && pendingMarkers.length > 0 && (
        <RideMap markers={pendingMarkers} />
      )}

      <div>
        <h2 className="text-lg font-semibold mb-3">Incoming Requests</h2>
        {pendingRides?.length === 0 && (
          <p className="text-sm text-muted-foreground">No pending ride requests.</p>
        )}
        <div className="space-y-2">
          {pendingRides?.map((ride) => (
            <motion.div
              key={ride.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="glass-surface rounded-lg p-4 flex items-center justify-between"
            >
              <div className="space-y-1 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-xs font-mono uppercase px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">
                    <ServiceIcon type={ride.service_type} />
                    {ride.service_type}
                  </span>
                  {ride.service_type === "shuttle" && (
                    <span className="text-xs text-muted-foreground">{ride.passenger_count} pax</span>
                  )}
                  {ride.service_type === "courier" && (ride as any).marketplace_delivery && (
                    <span className="flex items-center gap-1 text-xs text-yellow-500">
                      <ShoppingBag className="h-3 w-3" /> Marketplace
                    </span>
                  )}
                </div>
                <p className="text-sm font-medium truncate">
                  {ride.pickup_address} → {ride.dropoff_address}
                </p>
                {ride.service_type === "courier" && (ride as any).item_description && (
                  <p className="text-xs text-muted-foreground truncate">
                    📦 {(ride as any).item_description}
                  </p>
                )}
                {ride.service_type === "courier" && (ride as any).marketplace_delivery && (
                  <div className="flex items-center gap-1.5 text-[10px] text-yellow-500">
                    <AlertTriangle className="h-3 w-3" />
                    <span>Ensure vehicle capacity fits item</span>
                  </div>
                )}
                {ride.service_type === "large_delivery" && (ride as any).item_description && (
                  <p className="text-xs text-muted-foreground truncate">
                    📦 {(ride as any).item_description}
                  </p>
                )}
                {ride.service_type === "large_delivery" && (
                  <div className="flex flex-wrap gap-2 text-[10px]">
                    {(ride as any).weight_estimate_kg && (
                      <span className="text-muted-foreground">~{(ride as any).weight_estimate_kg} kg</span>
                    )}
                    {(ride as any).requires_loading_help && (
                      <span className="text-yellow-500">Loading help</span>
                    )}
                    {(ride as any).stairs_involved && (
                      <span className="text-yellow-500">Stairs</span>
                    )}
                  </div>
                )}
                <p className="text-xs text-muted-foreground font-mono">
                  ${Number(ride.estimated_price || 0).toFixed(2)}
                </p>
              </div>
              <div className="flex gap-2 ml-3 shrink-0">
                {ride.service_type === "large_delivery" ? (
                  <DriverBidForm
                    rideId={ride.id}
                    driverId={profile?.id || ""}
                    estimatedPrice={Number(ride.estimated_price || 0)}
                    existingBid={bidsByRide.get(ride.id) || null}
                    onBidChanged={() => queryClient.invalidateQueries({ queryKey: ["my-delivery-bids"] })}
                  />
                ) : (
                  <Button size="icon" variant="ghost" onClick={() => acceptRide(ride.id)}>
                    <Check className="h-4 w-4 text-green-400" />
                  </Button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DriverDispatch;
