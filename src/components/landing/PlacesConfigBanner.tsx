import { useEffect, useState } from "react";
import { AlertTriangle, ExternalLink, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

/**
 * Probes the `places-autocomplete` edge function on mount and surfaces a
 * banner when the Google Maps / Places API key is missing or invalid, so
 * site operators can fix it without digging through edge-function logs.
 *
 * The banner is intentionally non-blocking and dismissible per session.
 */
type ProbeStatus = "checking" | "ok" | "missing" | "invalid" | "unknown_error";

const DISMISS_KEY = "pickyou.places_banner_dismissed_v1";
const BACKEND_URL = "/?open=backend#secrets";

const PlacesConfigBanner = () => {
  const [status, setStatus] = useState<ProbeStatus>("checking");
  const [details, setDetails] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(DISMISS_KEY) === "1";
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Use a real-looking probe so Google actually evaluates the key.
        const { data, error } = await supabase.functions.invoke(
          "places-autocomplete",
          { body: { input: "Yellowknife" } }
        );

        if (cancelled) return;

        // Supabase returns a FunctionsHttpError when the function responds
        // with a non-2xx status. We still want to read the structured `code`
        // from the response body, so we fall back to the network response.
        const code: string | undefined = (data as any)?.code;
        const msg: string | undefined = (data as any)?.error;

        if (error) {
          // Try to peek at the response body the SDK attached to the error.
          let body: any = null;
          try {
            const ctx = (error as { context?: { json?: () => Promise<unknown> } }).context;
            body = await ctx?.json?.();
          } catch {
            /* no-op */
          }
          const errCode: string | undefined = body?.code;
          const errMsg: string | undefined = body?.error || error.message;
          if (errCode === "MISSING_API_KEY") {
            setStatus("missing");
            setDetails(errMsg ?? null);
          } else if (errCode === "INVALID_API_KEY") {
            setStatus("invalid");
            setDetails(body?.details || errMsg || null);
          } else {
            setStatus("unknown_error");
            setDetails(errMsg ?? null);
          }
          return;
        }

        if (code === "MISSING_API_KEY") {
          setStatus("missing");
          setDetails(msg ?? null);
        } else if (code === "INVALID_API_KEY") {
          setStatus("invalid");
          setDetails(msg ?? null);
        } else {
          setStatus("ok");
        }
      } catch (e: any) {
        if (cancelled) return;
        setStatus("unknown_error");
        setDetails(e?.message ?? null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* no-op */
    }
  };

  if (dismissed) return null;
  if (status === "checking" || status === "ok") return null;

  const title =
    status === "missing"
      ? "Address autocomplete is offline"
      : status === "invalid"
      ? "Google Places API key is misconfigured"
      : "Address autocomplete is unavailable";

  const body =
    status === "missing"
      ? "The GOOGLE_MAPS_API_KEY secret is not set on Lovable Cloud, so address suggestions can't load."
      : status === "invalid"
      ? "Google rejected the configured GOOGLE_MAPS_API_KEY. Check that the key is enabled for the Places API and that billing is active."
      : "We couldn't reach the address suggestions service.";

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "w-full border-b border-amber-500/30 bg-amber-500/10 text-amber-100",
        "supports-[backdrop-filter]:backdrop-blur"
      )}
    >
      <div className="mx-auto flex max-w-6xl items-start gap-3 px-4 py-2.5 text-xs sm:text-sm">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden />
        <div className="flex-1 leading-snug">
          <p className="font-semibold">{title}</p>
          <p className="text-amber-100/80">
            {body}{" "}
            <a
              href={BACKEND_URL}
              className="inline-flex items-center gap-1 font-semibold underline decoration-amber-300/60 underline-offset-2 hover:text-white"
            >
              Open backend secrets
              <ExternalLink className="h-3 w-3" aria-hidden />
            </a>{" "}
            and add or update <code className="rounded bg-black/30 px-1 py-0.5 text-[11px]">GOOGLE_MAPS_API_KEY</code>.
          </p>
          {details && (
            <p className="mt-1 truncate text-[11px] text-amber-100/60" title={details}>
              {details}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="ml-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-amber-100/70 transition hover:bg-black/20 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default PlacesConfigBanner;
