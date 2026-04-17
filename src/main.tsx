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

// Public host consolidation: redirect legacy hosts to the active custom domain
// (preserves path, query, hash). Skipped for OAuth proxy paths so the managed
// auth flow can complete on the original host.
const redirectToCanonicalHost = () => {
  if (isInIframe || isPreviewHost) return;
  if (isOAuthProxyPath) return;
  if (!legacyHosts.has(window.location.hostname)) return;

  const target = `https://${canonicalHost}${window.location.pathname}${window.location.search}${window.location.hash}`;
  window.location.replace(target);
};

const unregisterServiceWorkers = async () => {
  const registrations = await navigator.serviceWorker?.getRegistrations();
  await Promise.all((registrations ?? []).map((registration) => registration.unregister()));
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
  redirectToCanonicalHost();
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

  // Blank-screen watchdog: if React fails to mount (stale SW, broken chunk,
  // etc.) and #root is still empty after 4s, force-unregister SWs, clear
  // caches, and hard-reload once. Guarded by sessionStorage so we never loop.
  const watchdogKey = "__pickyou_blank_recovery__";
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
