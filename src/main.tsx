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

const bootstrap = async () => {
  normalizePathname();

  if (isPreviewHost || isInIframe) {
    await unregisterServiceWorkers();
  }

  if (shouldRecoverOAuthRoute()) {
    await Promise.allSettled([unregisterServiceWorkers(), clearBrowserCaches()]);
    window.location.replace(window.location.href);
    return;
  }

  createRoot(document.getElementById("root")!).render(<App />);
};

void bootstrap();
