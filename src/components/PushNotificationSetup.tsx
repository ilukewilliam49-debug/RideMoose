import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

/**
 * Registers the service worker and subscribes to push notifications.
 * Renders nothing — just a side-effect hook component.
 */
const PushNotificationSetup = () => {
  const { profile } = useAuth();

  useEffect(() => {
    if (!profile?.id || profile.role !== "driver") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    const setup = async () => {
      try {
        // Get VAPID public key from edge function
        const { data: vapidData, error: vapidErr } = await supabase.functions.invoke("push-vapid-key", {
          method: "GET",
        });
        if (vapidErr || !vapidData?.publicKey) return;

        const registration = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;

        const pushManager = (registration as any).pushManager;
        if (!pushManager) return;

        // Check existing subscription
        let subscription = await pushManager.getSubscription();
        if (!subscription) {
          const permission = await Notification.requestPermission();
          if (permission !== "granted") return;

          subscription = await pushManager.subscribe({
            userVisuallyPushes: true,
            applicationServerKey: urlBase64ToUint8Array(vapidData.publicKey),
          });
        }

        const subJson = subscription.toJSON();
        // Save to DB (upsert)
        await supabase.from("push_subscriptions").upsert({
          user_id: profile.id,
          endpoint: subJson.endpoint,
          p256dh: subJson.keys?.p256dh || "",
          auth: subJson.keys?.auth || "",
        } as any, { onConflict: "user_id,endpoint" });
      } catch (err) {
        // Silent fail — push is optional
        console.warn("Push notification setup failed:", err);
      }
    };

    setup();
  }, [profile?.id, profile?.role]);

  return null;
};

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default PushNotificationSetup;
