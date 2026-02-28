import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, rideId } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = rideId
      ? `You are a friendly and helpful customer support assistant for Swift Drive Dispatch, a ride and delivery platform.

The customer is contacting you about a large item delivery (Ride ID: ${rideId}) where no drivers accepted their offer after multiple price increases.

Your job is to:
- Empathize with their situation
- Help troubleshoot why drivers may not be bidding (time of day, location, price, item size)
- Suggest practical solutions (try again later, adjust delivery details, split into smaller loads)
- If the issue can't be resolved, offer to escalate to a human support agent
- Be concise, warm, and professional

You do NOT have access to modify rides or issue refunds directly. If the customer needs account changes or refunds, let them know a human agent will follow up within 24 hours.`
      : `You are a friendly and helpful customer support assistant for Swift Drive Dispatch, a ride and delivery platform.

You can help with:
- Questions about rides, deliveries, and services (Taxi, Private Hire, Shuttle, Courier, Large Item Delivery)
- Account and billing inquiries
- How to use the platform
- Troubleshooting ride or delivery issues
- Explaining pricing and payment options

Be concise, warm, and professional. If you can't resolve an issue, suggest the customer escalate to a human agent using the button in the chat.
You do NOT have access to modify rides, accounts, or issue refunds directly.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Too many requests. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Service temporarily unavailable. Please try again later." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Support chat is temporarily unavailable." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("support-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
