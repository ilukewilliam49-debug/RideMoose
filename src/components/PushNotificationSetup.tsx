import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Initialises OneSignal Web Push SDK and stores the player ID in the user's profile.
 * Renders nothing — side-effect only.
 */
const PushNotificationSetup = () => {
  const { profile } = useAuth();

  useEffect(() => {
    if (!profile?.id) return;

    const setup = async () => {
      try {
        // Fetch OneSignal App ID from edge function
        const { data, error } = await supabase.functions.invoke("onesignal-app-id", {
          method: "GET",
        });
        if (error || !data?.appId) {
          console.warn("Could not fetch OneSignal App ID");
          return;
        }

        const appId = data.appId;

        // Load OneSignal SDK if not already present
        if (!(window as any).OneSignal) {
          await loadOneSignalScript();
        }

        const OneSignal = (window as any).OneSignal;
        if (!OneSignal) return;

        await OneSignal.init({ appId, allowLocalhostAsSecureOrigin: true });

        // Wait until the user has subscribed (or is already subscribed)
        const playerId: string | null = await OneSignal.getUserId();
        if (playerId) {
          await savePlayerId(profile.id, playerId);
        }

        // Listen for future subscription changes
        OneSignal.on("subscriptionChange", async (isSubscribed: boolean) => {
          if (isSubscribed) {
            const newId: string | null = await OneSignal.getUserId();
            if (newId) await savePlayerId(profile.id, newId);
          }
        });
      } catch (err) {
        console.warn("OneSignal setup failed:", err);
      }
    };

    setup();
  }, [profile?.id]);

  return null;
};

async function savePlayerId(profileId: string, playerId: string) {
  await supabase
    .from("profiles")
    .update({ onesignal_player_id: playerId } as any)
    .eq("id", profileId);
}

function loadOneSignalScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load OneSignal SDK"));
    document.head.appendChild(script);
  });
}

export default PushNotificationSetup;
