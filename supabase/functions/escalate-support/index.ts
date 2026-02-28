import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get authenticated user
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");

    // Get profile id
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("user_id", user.id)
      .single();
    if (!profile) throw new Error("Profile not found");

    const { rideId, messages } = await req.json();

    // Save conversation
    const { data: conversation, error: insertErr } = await supabase
      .from("support_conversations")
      .insert({
        ride_id: rideId || null,
        user_id: profile.id,
        messages: messages,
        status: "open",
      })
      .select("id")
      .single();
    if (insertErr) throw insertErr;

    // Notify all admins
    const { data: admins } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "admin");

    if (admins?.length) {
      const notifications = admins.map((admin: any) => ({
        user_id: admin.id,
        title: "Support Escalation",
        body: `${profile.full_name || "A customer"} needs help with ${rideId ? "a delivery" : "a support request"}. Conversation saved for review.`,
        type: "support_escalation",
        ride_id: rideId || null,
      }));
      await supabase.from("notifications").insert(notifications);
    }

    return new Response(
      JSON.stringify({ success: true, conversationId: conversation.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("escalate-support error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
