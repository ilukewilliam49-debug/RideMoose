import { supabase } from "@/integrations/supabase/client";

export async function logAdminAction(
  action: string,
  targetType: string,
  targetId: string,
  details: Record<string, any> = {}
) {
  try {
    // Get admin's profile id
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();
    if (!profile) return;

    await supabase.from("admin_audit_log" as any).insert({
      admin_profile_id: profile.id,
      action,
      target_type: targetType,
      target_id: targetId,
      details,
    } as any);
  } catch (err) {
    console.error("Failed to log admin action:", err);
  }
}
