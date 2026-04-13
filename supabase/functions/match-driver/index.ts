import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DISPATCH_TIMEOUT_MS = 15_000;
const POLL_INTERVAL_MS = 3_000;
const MAX_CANDIDATES = 3;
const CITY_SPEED_KMH = 30;

/** Haversine distance in km */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Map service_type → profile capability filter */
function serviceFilter(serviceType: string): Record<string, any> {
  switch (serviceType) {
    case "taxi": return { can_taxi: true };
    case "private_hire": return { can_private_hire: true };
    case "shuttle": return { can_shuttle: true };
    case "courier":
    case "retail_delivery":
    case "personal_shopper": return { can_courier: true };
    case "food_delivery": return { can_food_delivery: true };
    case "pet_transport": return { pet_approved: true };
    case "large_delivery": return { vehicle_type_in: ["SUV", "truck", "van"] };
    default: return { can_taxi: true };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ride_id } = await req.json();
    if (!ride_id) {
      return new Response(JSON.stringify({ error: "ride_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const googleKey = Deno.env.get("GOOGLE_MAPS_API_KEY");

    // Validate caller owns the ride
    const authHeader = req.headers.get("Authorization");
    let callerUserId: string | null = null;
    if (authHeader?.startsWith("Bearer ")) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData, error: userErr } = await userClient.auth.getUser();
      if (!userErr && userData?.user) {
        callerUserId = userData.user.id;
      }
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Fetch ride
    const { data: ride, error: rideErr } = await admin
      .from("rides")
      .select("*")
      .eq("id", ride_id)
      .single();

    if (rideErr || !ride) {
      return new Response(JSON.stringify({ error: "Ride not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify ownership
    if (callerUserId) {
      const { data: riderProfile } = await admin
        .from("profiles")
        .select("id")
        .eq("user_id", callerUserId)
        .single();
      if (!riderProfile || riderProfile.id !== ride.rider_id) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (!ride.pickup_lat || !ride.pickup_lng) {
      return new Response(JSON.stringify({ error: "Ride has no pickup coordinates" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find eligible drivers
    const filters = serviceFilter(ride.service_type);
    let query = admin
      .from("profiles")
      .select("id, latitude, longitude, full_name")
      .eq("role", "driver")
      .eq("is_available", true)
      .not("latitude", "is", null)
      .not("longitude", "is", null);

    if (filters.vehicle_type_in) {
      query = query.in("vehicle_type", filters.vehicle_type_in);
    } else {
      for (const [key, val] of Object.entries(filters)) {
        query = query.eq(key, val);
      }
    }

    const { data: drivers } = await query;
    if (!drivers || drivers.length === 0) {
      return new Response(
        JSON.stringify({ matched: false, reason: "no_drivers_available" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate distances and sort
    const ranked = drivers
      .map((d) => ({
        ...d,
        distance_km: haversineKm(
          ride.pickup_lat!,
          ride.pickup_lng!,
          d.latitude!,
          d.longitude!
        ),
      }))
      .sort((a, b) => a.distance_km - b.distance_km)
      .slice(0, MAX_CANDIDATES);

    // Sequential dispatch
    for (const candidate of ranked) {
      // Mark ride as dispatched to this driver
      await admin.from("rides").update({
        status: "dispatched",
        dispatched_to_driver_id: candidate.id,
        dispatch_expires_at: new Date(Date.now() + DISPATCH_TIMEOUT_MS).toISOString(),
      }).eq("id", ride_id);

      // Notify driver
      await admin.from("notifications").insert({
        user_id: candidate.id,
        title: "New ride request",
        body: `Pickup at ${ride.pickup_address}`,
        type: "dispatch",
        ride_id: ride_id,
      });

      // Poll for acceptance
      let accepted = false;
      const deadline = Date.now() + DISPATCH_TIMEOUT_MS;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        const { data: updated } = await admin
          .from("rides")
          .select("status, driver_id")
          .eq("id", ride_id)
          .single();

        if (updated?.status === "accepted" && updated?.driver_id === candidate.id) {
          accepted = true;
          break;
        }
        // If ride was cancelled while dispatching
        if (updated?.status === "cancelled") {
          return new Response(
            JSON.stringify({ matched: false, reason: "ride_cancelled" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      if (accepted) {
        // Clear dispatch fields
        await admin.from("rides").update({
          dispatched_to_driver_id: null,
          dispatch_expires_at: null,
        }).eq("id", ride_id);

        // Get ETA via Directions API
        let etaSeconds = Math.round((candidate.distance_km / CITY_SPEED_KMH) * 3600);
        let etaText = `${Math.round(etaSeconds / 60)} min`;
        let distanceKm = candidate.distance_km;

        if (googleKey && candidate.latitude && candidate.longitude) {
          try {
            const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${candidate.latitude},${candidate.longitude}&destination=${ride.pickup_lat},${ride.pickup_lng}&departure_time=now&key=${googleKey}`;
            const resp = await fetch(url);
            const json = await resp.json();
            if (json.routes?.[0]?.legs?.[0]) {
              const leg = json.routes[0].legs[0];
              etaSeconds = leg.duration_in_traffic?.value || leg.duration.value;
              etaText = leg.duration_in_traffic?.text || leg.duration.text;
              distanceKm = leg.distance.value / 1000;
            }
          } catch {
            // fallback to Haversine estimate
          }
        }

        return new Response(
          JSON.stringify({
            matched: true,
            driver_id: candidate.id,
            driver_name: candidate.full_name,
            eta_seconds: etaSeconds,
            eta_text: etaText,
            distance_km: Math.round(distanceKm * 10) / 10,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Not accepted — clear dispatch for this candidate and try next
      await admin.from("rides").update({
        dispatched_to_driver_id: null,
        dispatch_expires_at: null,
      }).eq("id", ride_id);
    }

    // No driver matched — reset ride
    await admin.from("rides").update({
      status: "requested",
      dispatched_to_driver_id: null,
      dispatch_expires_at: null,
    }).eq("id", ride_id);

    return new Response(
      JSON.stringify({ matched: false, reason: "no_driver_accepted" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
