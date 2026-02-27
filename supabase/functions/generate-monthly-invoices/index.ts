import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function monthName(d: Date): string {
  return d.toLocaleString("en-US", { month: "long", year: "numeric" });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Optional: allow manual trigger with a specific org_id
    let body: { organization_id?: string } = {};
    try {
      body = await req.json();
    } catch {
      // No body = cron trigger, process all orgs
    }

    // Calculate previous calendar month boundaries
    const now = new Date();
    const periodEnd = new Date(now.getFullYear(), now.getMonth(), 0); // last day of prev month
    const periodStart = new Date(periodEnd.getFullYear(), periodEnd.getMonth(), 1); // first day of prev month
    const periodStartStr = periodStart.toISOString().split("T")[0];
    const periodEndStr = periodEnd.toISOString().split("T")[0];
    const periodStartTs = periodStart.toISOString();
    const periodEndTs = new Date(
      periodEnd.getFullYear(),
      periodEnd.getMonth(),
      periodEnd.getDate(),
      23, 59, 59, 999
    ).toISOString();

    const yyyy = String(periodStart.getFullYear());
    const mm = String(periodStart.getMonth() + 1).padStart(2, "0");

    // Fetch approved organizations
    let orgsQuery = serviceClient
      .from("organizations")
      .select("*")
      .eq("status", "approved");

    if (body.organization_id) {
      orgsQuery = orgsQuery.eq("id", body.organization_id);
    }

    const { data: orgs, error: orgsError } = await orgsQuery;
    if (orgsError) throw new Error(orgsError.message);
    if (!orgs || orgs.length === 0) {
      return new Response(
        JSON.stringify({ message: "No approved organizations to invoice" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Get current max invoice sequence for this month across all orgs
    const prefix = `OK-${yyyy}-${mm}-`;
    const { data: existingInvoices } = await serviceClient
      .from("invoices")
      .select("invoice_number")
      .like("invoice_number", `${prefix}%`)
      .order("invoice_number", { ascending: false })
      .limit(1);

    let sequenceCounter = 0;
    if (existingInvoices && existingInvoices.length > 0 && existingInvoices[0].invoice_number) {
      const lastNum = existingInvoices[0].invoice_number;
      const seqPart = lastNum.split("-").pop();
      sequenceCounter = parseInt(seqPart || "0", 10);
    }

    const results: any[] = [];

    for (const org of orgs) {
      // Fetch uninvoiced completed rides for this org within the period
      const { data: rides, error: ridesError } = await serviceClient
        .from("rides")
        .select("id, pickup_address, dropoff_address, final_fare_cents, final_price, completed_at, rider_id, service_type, passenger_count, po_number, cost_center")
        .eq("organization_id", org.id)
        .eq("billed_to", "organization")
        .eq("invoiced", false)
        .eq("status", "completed")
        .gte("completed_at", periodStartTs)
        .lte("completed_at", periodEndTs)
        .order("completed_at", { ascending: true });

      if (ridesError) {
        console.error(`Error fetching rides for org ${org.id}:`, ridesError.message);
        results.push({ org_id: org.id, org_name: org.name, error: ridesError.message });
        continue;
      }

      if (!rides || rides.length === 0) {
        results.push({ org_id: org.id, org_name: org.name, skipped: true, reason: "no_rides" });
        continue;
      }

      const totalCents = rides.reduce(
        (sum, r) => sum + (r.final_fare_cents || Math.round((r.final_price || 0) * 100)),
        0
      );

      const dueDate = new Date(now);
      dueDate.setDate(dueDate.getDate() + (org.payment_terms_days || 30));

      // Generate invoice number: OK-YYYY-MM-####
      sequenceCounter++;
      const invoiceNumber = `${prefix}${String(sequenceCounter).padStart(4, "0")}`;

      // Create invoice
      const { data: invoice, error: invoiceError } = await serviceClient
        .from("invoices")
        .insert({
          organization_id: org.id,
          invoice_number: invoiceNumber,
          period_start: periodStartStr,
          period_end: periodEndStr,
          issue_date: now.toISOString().split("T")[0],
          due_date: dueDate.toISOString().split("T")[0],
          status: "issued",
          total_cents: totalCents,
          ride_count: rides.length,
        })
        .select("id")
        .single();

      if (invoiceError) {
        console.error(`Error creating invoice for org ${org.id}:`, invoiceError.message);
        results.push({ org_id: org.id, org_name: org.name, error: invoiceError.message });
        continue;
      }

      // Update rides: set invoiced=true and invoice_id
      const rideIds = rides.map((r) => r.id);
      await serviceClient
        .from("rides")
        .update({ invoiced: true, invoice_id: invoice.id })
        .in("id", rideIds);

      // Generate CSV with required columns
      const csvHeader = "invoice_number,organization,ride_id,ride_date,pickup,dropoff,passenger,service_type,po_number,cost_center,total_cents\n";
      const csvRows = rides
        .map((r) => {
          const fareCents = r.final_fare_cents || Math.round((r.final_price || 0) * 100);
          const pickup = `"${(r.pickup_address || "").replace(/"/g, '""')}"`;
          const dropoff = `"${(r.dropoff_address || "").replace(/"/g, '""')}"`;
          const rideDate = r.completed_at ? r.completed_at.split("T")[0] : "";
          const po = `"${(r.po_number || "").replace(/"/g, '""')}"`;
          const cc = `"${(r.cost_center || "").replace(/"/g, '""')}"`;
          return `${invoiceNumber},"${org.name.replace(/"/g, '""')}",${r.id},${rideDate},${pickup},${dropoff},${r.passenger_count || 1},${r.service_type},${po},${cc},${fareCents}`;
        })
        .join("\n");
      const csvContent = csvHeader + csvRows;

      // Send email via Resend if API key is available
      const resendKey = Deno.env.get("RESEND_API_KEY");
      let emailSent = false;
      if (resendKey && org.billing_email) {
        try {
          const csvBase64 = btoa(unescape(encodeURIComponent(csvContent)));
          const monthLabel = monthName(periodStart);

          const emailRes = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${resendKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: Deno.env.get("INVOICE_FROM_EMAIL") || "invoices@yourdomain.com",
              to: [org.billing_email],
              subject: `OnlyKnifers Invoice ${invoiceNumber} – ${monthLabel}`,
              html: `
                <h2>Invoice ${invoiceNumber}</h2>
                <p><strong>${org.name}</strong></p>
                <p>Period: ${periodStartStr} to ${periodEndStr}</p>
                <p>Rides: <strong>${rides.length}</strong></p>
                <p>Total: <strong>$${(totalCents / 100).toFixed(2)} CAD</strong></p>
                <p>Due Date: <strong>${dueDate.toISOString().split("T")[0]}</strong> (Net ${org.payment_terms_days || 30} days)</p>
                <p>Please find the ride details in the attached CSV.</p>
              `,
              attachments: [
                {
                  filename: `${invoiceNumber}.csv`,
                  content: csvBase64,
                },
              ],
            }),
          });

          emailSent = emailRes.ok;
          if (!emailRes.ok) {
            console.error("Resend error:", await emailRes.text());
          }
        } catch (e) {
          console.error("Email send error:", e);
        }
      }

      results.push({
        org_id: org.id,
        org_name: org.name,
        invoice_id: invoice.id,
        invoice_number: invoiceNumber,
        total_cents: totalCents,
        ride_count: rides.length,
        period: `${periodStartStr} to ${periodEndStr}`,
        due_date: dueDate.toISOString().split("T")[0],
        email_sent: emailSent,
      });
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("generate-monthly-invoices error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
