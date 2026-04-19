import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { phone, otp } = await req.json();
    if (!phone || !otp) {
      return new Response(
        JSON.stringify({ error: "Phone and OTP are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find valid OTP
    const { data: otpRecord, error: otpError } = await supabaseAdmin
      .from("phone_otps")
      .select("*")
      .eq("phone", phone)
      .eq("otp_code", otp)
      .eq("verified", false)
      .gte("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (otpError || !otpRecord) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired verification code" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark OTP as verified
    await supabaseAdmin
      .from("phone_otps")
      .update({ verified: true })
      .eq("id", otpRecord.id);

    // Clean up old OTPs for this phone
    await supabaseAdmin
      .from("phone_otps")
      .delete()
      .eq("phone", phone)
      .neq("id", otpRecord.id);

    // Check if a user with this phone already exists (in profiles)
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("user_id")
      .eq("phone", phone)
      .limit(1)
      .single();

    let userId: string;

    if (existingProfile) {
      userId = existingProfile.user_id;
      // Update phone_verified
      await supabaseAdmin
        .from("profiles")
        .update({ phone_verified: true })
        .eq("user_id", userId);
    } else {
      // No profile row for this phone — create the auth user. We attach a
      // synthetic email because the legacy admin SDK requires one for the
      // session-forging path below. Tracked as follow-up to remove.
      const tempEmail = `phone_${phone.replace(/\+/g, "")}@pickyou.local`;
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        phone,
        phone_confirm: true,
        email: tempEmail,
        email_confirm: true,
        user_metadata: { full_name: "", role: "rider", phone_verified: true },
      });

      if (createError) {
        // createUser failed — most likely a phone-conflict (auth row exists
        // but no profile row was created). Only then pay the cost of a full
        // listUsers() scan. At scale this should be replaced with a direct
        // phone lookup once the SDK supports it.
        const msg = (createError.message || "").toLowerCase();
        const isConflict = msg.includes("already") || msg.includes("exists") || msg.includes("duplicate") || msg.includes("registered");
        if (!isConflict) throw createError;

        const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
        const foundUser = users?.find((u) => u.phone === phone);
        if (!foundUser) throw createError;
        userId = foundUser.id;
        await supabaseAdmin
          .from("profiles")
          .update({ phone_verified: true, phone })
          .eq("user_id", userId);
      } else {
        userId = newUser.user.id;
      }
    }

    // Generate a session for the user using admin API
    // We'll use a magic link approach — generate a one-time token
    // Actually, we need to use admin.generateLink which requires email
    // Instead, let's use the approach of creating a custom session
    
    // Get the user to create a proper session
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (userError || !userData.user) throw userError || new Error("User not found");

    // Generate a magic link for the user's email (to create a session)
    const userEmail = userData.user.email;
    if (!userEmail) {
      throw new Error("User has no email for session generation");
    }

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: userEmail,
    });

    if (linkError || !linkData) throw linkError || new Error("Failed to generate session link");

    // Extract the token from the link and exchange it for a session
    const hashed_token = linkData.properties?.hashed_token;
    if (!hashed_token) throw new Error("No token in link");

    // Use the OTP verification endpoint to exchange the token
    const { data: session, error: verifyError } = await supabaseAdmin.auth.verifyOtp({
      token_hash: hashed_token,
      type: "magiclink",
    });

    if (verifyError || !session.session) {
      throw verifyError || new Error("Failed to create session");
    }

    return new Response(
      JSON.stringify({
        success: true,
        session: {
          access_token: session.session.access_token,
          refresh_token: session.session.refresh_token,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("verify-login-otp error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
