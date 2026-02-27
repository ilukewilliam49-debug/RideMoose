import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const now = new Date();
    const cutoffDate = new Date(now);
    cutoffDate.setDate(cutoffDate.getDate() - 20);
    const cutoffStr = cutoffDate.toISOString().split("T")[0];

    // Find issued invoices that are overdue by more than 20 days
    const { data: overdueInvoices, error: invError } = await serviceClient
      .from("invoices")
      .select("id, organization_id, due_date, status")
      .eq("status", "issued")
      .lt("due_date", cutoffStr);

    if (invError) throw new Error(invError.message);

    if (!overdueInvoices || overdueInvoices.length === 0) {
      return new Response(
        JSON.stringify({ message: "No overdue invoices found", suspended: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Mark invoices as overdue
    const invoiceIds = overdueInvoices.map((i) => i.id);
    await serviceClient
      .from("invoices")
      .update({ status: "overdue" })
      .in("id", invoiceIds);

    // Get unique org IDs and suspend them
    const orgIds = [...new Set(overdueInvoices.map((i) => i.organization_id))];

    for (const orgId of orgIds) {
      await serviceClient
        .from("organizations")
        .update({ status: "suspended" })
        .eq("id", orgId)
        .eq("status", "approved"); // only suspend currently approved orgs
    }

    return new Response(
      JSON.stringify({
        message: `Processed ${overdueInvoices.length} overdue invoices`,
        overdue_invoices: invoiceIds.length,
        suspended_orgs: orgIds.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("check-overdue-invoices error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
