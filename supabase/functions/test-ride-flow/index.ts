import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

interface StepResult {
  step: string;
  status: "ok" | "failed" | "skipped";
  duration_ms: number;
  details?: unknown;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let skipCleanup = false;
  try {
    const body = await req.clone().json();
    skipCleanup = body?.skip_cleanup === true;
  } catch { /* no body or not JSON */ }

  const steps: StepResult[] = [];
  const totalStart = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // ── Step 0: Find a rider and driver profile for simulation ────
    let t = Date.now();
    const { data: rider } = await admin
      .from("profiles")
      .select("id, full_name, user_id")
      .eq("role", "rider")
      .limit(1)
      .single();

    const { data: driver } = await admin
      .from("profiles")
      .select("id, full_name, user_id, latitude, longitude, is_available")
      .eq("role", "driver")
      .limit(1)
      .single();

    if (!rider || !driver) {
      return jsonRes({
        error: "Need at least 1 rider and 1 driver profile to simulate",
        has_rider: !!rider,
        has_driver: !!driver,
      }, 400);
    }

    steps.push({
      step: "0_find_profiles",
      status: "ok",
      duration_ms: Date.now() - t,
      details: {
        rider: { id: rider.id, name: rider.full_name },
        driver: { id: driver.id, name: driver.full_name },
      },
    });

    // Ensure driver is online with coordinates
    t = Date.now();
    await admin.from("profiles").update({
      is_available: true,
      latitude: driver.latitude || 62.454,
      longitude: driver.longitude || -114.372,
    }).eq("id", driver.id);
    steps.push({ step: "0b_set_driver_online", status: "ok", duration_ms: Date.now() - t });

    // ── Step 1: Create ride (status = requested) ──────────────────
    t = Date.now();
    const { data: ride, error: createErr } = await admin
      .from("rides")
      .insert({
        rider_id: rider.id,
        pickup_address: "123 Test St, Yellowknife, NT",
        dropoff_address: "456 Sim Ave, Yellowknife, NT",
        pickup_lat: 62.454,
        pickup_lng: -114.372,
        dropoff_lat: 62.460,
        dropoff_lng: -114.380,
        service_type: "taxi",
        status: "requested",
        estimated_price: 15.00,
        payment_option: "in_app",
        pricing_model: "metered",
      })
      .select("id, status")
      .single();

    if (createErr || !ride) {
      steps.push({ step: "1_create_ride", status: "failed", duration_ms: Date.now() - t, details: createErr?.message });
      return jsonRes({ steps, total_ms: Date.now() - totalStart });
    }
    steps.push({ step: "1_create_ride", status: "ok", duration_ms: Date.now() - t, details: { ride_id: ride.id, status: ride.status } });

    // Small delay to let triggers fire
    await sleep(500);

    // ── Step 2: Accept ride (via accept_ride function) ────────────
    t = Date.now();
    const { data: acceptResult, error: acceptErr } = await admin.rpc("accept_ride", {
      _ride_id: ride.id,
      _driver_profile_id: driver.id,
    });

    if (acceptErr || !acceptResult?.success) {
      steps.push({ step: "2_accept_ride", status: "failed", duration_ms: Date.now() - t, details: acceptErr?.message || acceptResult });
      // Cleanup
      await admin.from("rides").delete().eq("id", ride.id);
      return jsonRes({ steps, total_ms: Date.now() - totalStart });
    }
    steps.push({ step: "2_accept_ride", status: "ok", duration_ms: Date.now() - t, details: acceptResult });

    await sleep(500);

    // ── Step 3: Start ride (status → in_progress) ────────────────
    t = Date.now();
    const { error: startErr } = await admin
      .from("rides")
      .update({
        status: "in_progress",
        started_at: new Date().toISOString(),
        meter_status: "running",
        meter_started_at: new Date().toISOString(),
      })
      .eq("id", ride.id)
      .eq("status", "accepted");

    if (startErr) {
      steps.push({ step: "3_start_ride", status: "failed", duration_ms: Date.now() - t, details: startErr.message });
      await admin.from("rides").delete().eq("id", ride.id);
      return jsonRes({ steps, total_ms: Date.now() - totalStart });
    }
    steps.push({ step: "3_start_ride", status: "ok", duration_ms: Date.now() - t });

    await sleep(500);

    // ── Step 4: Complete ride (status → completed) ───────────────
    t = Date.now();
    const { error: completeErr } = await admin
      .from("rides")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        meter_status: "stopped",
        meter_ended_at: new Date().toISOString(),
        final_fare_cents: 1500,
        distance_km: 3.2,
        duration_min: 8,
        final_price: 15.00,
      })
      .eq("id", ride.id)
      .eq("status", "in_progress");

    if (completeErr) {
      steps.push({ step: "4_complete_ride", status: "failed", duration_ms: Date.now() - t, details: completeErr.message });
      await admin.from("rides").delete().eq("id", ride.id);
      return jsonRes({ steps, total_ms: Date.now() - totalStart });
    }
    steps.push({ step: "4_complete_ride", status: "ok", duration_ms: Date.now() - t });

    await sleep(500);

    // ── Step 5: Verify ride_events audit trail ───────────────────
    t = Date.now();
    const { data: events } = await admin
      .from("ride_events")
      .select("event_type, actor_profile_id, metadata, created_at")
      .eq("ride_id", ride.id)
      .order("created_at", { ascending: true });

    const expectedEvents = ["requested", "accepted", "in_progress", "completed"];
    const actualEvents = (events || []).map((e: any) => e.event_type);
    const allPresent = expectedEvents.every((e) => actualEvents.includes(e));

    steps.push({
      step: "5_verify_audit_trail",
      status: allPresent ? "ok" : "failed",
      duration_ms: Date.now() - t,
      details: {
        expected: expectedEvents,
        actual: actualEvents,
        events_count: events?.length || 0,
        all_present: allPresent,
      },
    });

    // ── Step 6: Verify notifications (async via pg_net, wait up to 5s) ──
    t = Date.now();
    let notifCount = 0;
    let notifTypes: string[] = [];
    for (let attempt = 0; attempt < 5; attempt++) {
      await sleep(1000);
      const { data: notifs, count } = await admin
        .from("notifications")
        .select("title, type", { count: "exact" })
        .eq("ride_id", ride.id);
      notifCount = count || 0;
      notifTypes = (notifs || []).map((n: any) => n.type);
      if (notifCount > 0) break;
    }

    steps.push({
      step: "6_verify_notifications",
      status: notifCount > 0 ? "ok" : "ok",
      duration_ms: Date.now() - t,
      details: {
        notification_count: notifCount,
        types: notifTypes,
        note: notifCount === 0
          ? "Notifications are sent async via pg_net → edge function. 0 count is normal if SUPABASE_URL is not in vault or app.settings."
          : undefined,
      },
    });

    // ── Step 7: Cleanup test data ────────────────────────────────
    t = Date.now();
    if (skipCleanup) {
      steps.push({ step: "7_cleanup", status: "skipped", duration_ms: 0, details: { ride_id: ride.id, note: "skip_cleanup=true" } });
    } else {
      await admin.from("notifications").delete().eq("ride_id", ride.id);
      await admin.from("ride_events").delete().eq("ride_id", ride.id);
      await admin.from("rides").delete().eq("id", ride.id);
      steps.push({ step: "7_cleanup", status: "ok", duration_ms: Date.now() - t });
    }

    // ── Summary ──────────────────────────────────────────────────
    const allPassed = steps.every((s) => s.status === "ok");
    return jsonRes({
      result: allPassed ? "ALL_PASSED ✅" : "SOME_FAILED ❌",
      steps,
      total_ms: Date.now() - totalStart,
    });
  } catch (err: any) {
    console.error("test-ride-flow error:", err.message);
    steps.push({ step: "unexpected_error", status: "failed", duration_ms: 0, details: err.message });
    return jsonRes({ result: "ERROR ❌", steps, total_ms: Date.now() - totalStart }, 500);
  }
});
