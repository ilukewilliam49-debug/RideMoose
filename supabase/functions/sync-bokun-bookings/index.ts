import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function formatDate(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

async function hmacSha1(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const msgData = encoder.encode(message);
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, msgData);
  const bytes = new Uint8Array(sig);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

const BOKUN_BASE = "https://api.bokun.io";

async function bokunFetch(accessKey: string, secretKey: string, method: string, path: string, body?: any) {
  const dateStr = formatDate(new Date());
  const signatureBase = dateStr + accessKey + method + path;
  const signature = await hmacSha1(secretKey, signatureBase);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Bokun-Date": dateStr,
    "X-Bokun-AccessKey": accessKey,
    "X-Bokun-Signature": signature,
  };

  const opts: RequestInit = { method, headers };
  if (body && (method === "POST" || method === "PUT")) {
    opts.body = JSON.stringify(body);
  }

  console.log(`Bókun ${method} ${path}`);
  const response = await fetch(BOKUN_BASE + path, opts);
  const text = await response.text();
  console.log(`Bókun response [${response.status}]: ${text.substring(0, 500)}`);

  if (!response.ok) {
    throw new Error(`Bókun API [${response.status}]: ${text.substring(0, 300)}`);
  }

  return JSON.parse(text);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const accessKey = Deno.env.get("BOKUN_ACCESS_KEY");
    const secretKey = Deno.env.get("BOKUN_SECRET_KEY");
    if (!accessKey || !secretKey) {
      throw new Error("BOKUN_ACCESS_KEY or BOKUN_SECRET_KEY not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get sync status
    const { data: syncState } = await supabase
      .from("bokun_sync_status")
      .select("*")
      .eq("resource_type", "bookings")
      .maybeSingle();

    // Update status to running
    await supabase
      .from("bokun_sync_status")
      .update({ status: "running", error_message: null })
      .eq("resource_type", "bookings");

    // Try multiple endpoints in order of likelihood
    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const searchBody = {
      startDate: {
        year: ninetyDaysAgo.getUTCFullYear(),
        month: ninetyDaysAgo.getUTCMonth() + 1,
        day: ninetyDaysAgo.getUTCDate(),
      },
      endDate: {
        year: now.getUTCFullYear(),
        month: now.getUTCMonth() + 1,
        day: now.getUTCDate() + 1,
      },
    };

    let bookingArray: any[] = [];
    let endpoint = "";

    // Try booking-search endpoint first (itinerary bookings)
    const endpoints = [
      { path: "/booking.json/booking-search", method: "POST", body: searchBody },
      { path: "/booking.json/product-booking-search", method: "POST", body: searchBody },
    ];

    for (const ep of endpoints) {
      try {
        const data = await bokunFetch(accessKey, secretKey, ep.method, ep.path, ep.body);
        endpoint = ep.path;
        
        // Handle different response shapes
        if (Array.isArray(data)) {
          bookingArray = data;
        } else if (data.items) {
          bookingArray = data.items;
        } else if (data.results) {
          bookingArray = data.results;
        } else if (data.bookings) {
          bookingArray = data.bookings;
        }
        
        console.log(`Success with ${ep.path}: found ${bookingArray.length} bookings`);
        break;
      } catch (err) {
        console.log(`Endpoint ${ep.path} failed: ${(err as Error).message}`);
        continue;
      }
    }

    console.log(`Total bookings to sync: ${bookingArray.length} from ${endpoint}`);

    let synced = 0;
    const BATCH_SIZE = 50;

    for (let i = 0; i < bookingArray.length; i += BATCH_SIZE) {
      const batch = bookingArray.slice(i, i + BATCH_SIZE).map((b: any, idx: number) => {
        const bookingId = String(b.id || b.bookingId || b.confirmationCode || `unknown-${Date.now()}-${idx}`);
        const pb = b.productBookings?.[0];

        // Dates are Unix ms timestamps
        let bookingDate = null;
        const rawDate = pb?.startDate || pb?.startDateTime || b.creationDate;
        if (rawDate && typeof rawDate === "number") {
          bookingDate = new Date(rawDate).toISOString().substring(0, 10);
        } else if (rawDate && typeof rawDate === "object" && rawDate.year) {
          bookingDate = `${rawDate.year}-${String(rawDate.month).padStart(2, "0")}-${String(rawDate.day).padStart(2, "0")}`;
        }

        const startTime = pb?.fields?.startTimeStr || null;
        const customerName = b.customer ? `${b.customer.firstName || ""} ${b.customer.lastName || ""}`.trim() || null : null;
        const customerEmail = b.customer?.email || null;
        const customerPhone = b.customer?.phoneNumber || null;
        const productTitle = pb?.product?.title || pb?.rateTitle || null;
        const productId = pb?.product?.id ? String(pb.product.id) : null;
        const invoice = pb?.customerInvoice || pb?.resellerInvoice;
        const totalPriceCents = invoice?.total ? Math.round(Number(invoice.total) * 100) : 0;
        const sellerName = pb?.seller?.title || b.seller?.title || null;
        const participants = pb?.totalParticipants || 1;
        const notes = pb?.notes?.length ? pb.notes.map((n: any) => n.body).join("; ") : null;

        return {
          bokun_booking_id: bookingId,
          confirmation_code: b.confirmationCode || null,
          status: pb?.status || b.status || "CONFIRMED",
          product_title: productTitle,
          product_id: productId,
          customer_name: customerName,
          customer_email: customerEmail,
          customer_phone: customerPhone,
          booking_date: bookingDate,
          start_time: startTime,
          total_price_cents: totalPriceCents,
          currency: b.currency || "ISK",
          participants,
          seller_name: sellerName,
          notes,
          raw_data: b,
          synced_at: new Date().toISOString(),
        };
      });

      const { error: upsertError } = await supabase
        .from("bokun_bookings")
        .upsert(batch, { onConflict: "bokun_booking_id" });

      if (upsertError) {
        console.error("Upsert error:", upsertError);
      } else {
        synced += batch.length;
      }
    }

    // Update sync status
    await supabase
      .from("bokun_sync_status")
      .update({
        status: "completed",
        last_synced_at: new Date().toISOString(),
        total_synced: synced,
        error_message: null,
      })
      .eq("resource_type", "bookings");

    return new Response(
      JSON.stringify({ success: true, synced, endpoint, total_in_response: bookingArray.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Sync error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // Try to update sync status with error
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      await supabase
        .from("bokun_sync_status")
        .update({ status: "error", error_message: errorMessage })
        .eq("resource_type", "bookings");
    } catch {}

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
