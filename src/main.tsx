import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n";

const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com");

const isOAuthProxyPath = window.location.pathname.startsWith("/~oauth/");
const oauthRecoveryKey = "__oauth_sw_recovery__";
const canonicalHost = "www.pickyou.ca";
const legacyHosts = new Set(["pickyou.lovable.app", "pickyou.ca"]);

// Kill-switch: bump this string when stale Service Workers / caches need to
// be force-purged across all origins. Stored per-origin in localStorage so
// each browser self-cleans exactly once per version.
const KILL_SWITCH_VERSION = "2026-04-17-sw-purge-1";
const KILL_SWITCH_KEY = "__pickyou_sw_purge__";

// Public host consolidation: redirect legacy hosts to the active custom domain
// (preserves path, query, hash). Before redirecting, force-unregister the
// legacy origin's Service Worker + caches so it can never serve stale content
// on the next visit. Skipped for OAuth proxy paths so the managed auth flow
// can complete on the original host.
const redirectToCanonicalHost = async () => {
  if (isInIframe || isPreviewHost) return;
  if (isOAuthProxyPath) return;
  if (!legacyHosts.has(window.location.hostname)) return;

  // Self-clean the legacy origin so re-visits don't resurrect stale builds.
  await Promise.allSettled([unregisterServiceWorkers(), clearBrowserCaches()]);

  const target = `https://${canonicalHost}${window.location.pathname}${window.location.search}${window.location.hash}`;
  window.location.replace(target);
};

// One-time kill-switch: when KILL_SWITCH_VERSION changes, force every
// origin (including the canonical host) to drop its old Service Worker and
// caches, then reload once. Guarded by localStorage so it never loops.
const runKillSwitchOnce = async () => {
  if (isInIframe || isPreviewHost) return false;
  try {
    if (localStorage.getItem(KILL_SWITCH_KEY) === KILL_SWITCH_VERSION) return false;
    await Promise.allSettled([unregisterServiceWorkers(), clearBrowserCaches()]);
    localStorage.setItem(KILL_SWITCH_KEY, KILL_SWITCH_VERSION);
    window.location.reload();
    return true;
  } catch {
    return false;
  }
};

const unregisterServiceWorkers = async () => {
  if (!("serviceWorker" in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  if (!registrations.length) return;
  await Promise.all(registrations.map((registration) => registration.unregister()));
};

const clearBrowserCaches = async () => {
  if (!("caches" in window)) return;
  const cacheKeys = await caches.keys();
  await Promise.all(cacheKeys.map((key) => caches.delete(key)));
};

const shouldRecoverOAuthRoute = () => {
  if (!isOAuthProxyPath) return false;

  try {
    if (sessionStorage.getItem(oauthRecoveryKey) === "done") {
      sessionStorage.removeItem(oauthRecoveryKey);
      return false;
    }

    sessionStorage.setItem(oauthRecoveryKey, "done");
    return true;
  } catch {
    return true;
  }
};

const normalizePathname = () => {
  const { pathname, search, hash } = window.location;
  const strayPaths: Record<string, string> = {
    "/index": "/",
    "/index.html": "/",
    "/home": "/",
  };
  const normalized = strayPaths[pathname.toLowerCase()];
  if (normalized) {
    window.history.replaceState(null, "", normalized + search + hash);
  }
};

// "Remember me" off → wipe Supabase auth tokens from localStorage when the
// tab/window is closed, so the user must re-authenticate on next open.
// Uses pagehide (more reliable than beforeunload, esp. on mobile Safari).
const installSessionOnlyTokenWipe = () => {
  const wipe = () => {
    try {
      if (localStorage.getItem("pickyou.session_only") !== "1") return;
      // Supabase JS v2 stores tokens under keys starting with "sb-"
      Object.keys(localStorage)
        .filter((k) => k.startsWith("sb-") && k.endsWith("-auth-token"))
        .forEach((k) => localStorage.removeItem(k));
      localStorage.removeItem("pickyou.session_only");
    } catch {
      /* ignore storage errors */
    }
  };
  window.addEventListener("pagehide", wipe);
};

const bootstrap = async () => {
  // Run kill-switch first — if it fires, we reload and bail before anything else.
  if (await runKillSwitchOnce()) return;

  await redirectToCanonicalHost();
  normalizePathname();

  if (isPreviewHost || isInIframe) {
    await unregisterServiceWorkers();
  }

  if (shouldRecoverOAuthRoute()) {
    await Promise.allSettled([unregisterServiceWorkers(), clearBrowserCaches()]);
    window.location.replace(window.location.href);
    return;
  }

  installSessionOnlyTokenWipe();
  const rootEl = document.getElementById("root")!;
  createRoot(rootEl).render(<App />);

  // Fade out the pre-mount loader once React has painted the first frame.
  requestAnimationFrame(() => {
    const loader = document.getElementById("initial-loader");
    if (!loader) return;
    loader.classList.add("hidden");
    setTimeout(() => loader.remove(), 350);
  });

  // Blank-screen watchdog: if React fails to mount (stale SW, broken chunk,
  // etc.) and #root is still empty after 4s, force-unregister SWs, clear
  // caches, and hard-reload once. Guarded by sessionStorage so we never loop.
  const watchdogKey = `__pickyou_blank_recovery__:${window.location.pathname}`;
  setTimeout(() => {
    if (rootEl.childElementCount > 0) return;
    try {
      if (sessionStorage.getItem(watchdogKey) === "1") return;
      sessionStorage.setItem(watchdogKey, "1");
    } catch {
      /* ignore */
    }
    void Promise.allSettled([unregisterServiceWorkers(), clearBrowserCaches()]).then(
      () => window.location.reload(),
    );
  }, 4000);
};

void bootstrap();
