import React from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

const CHUNK_RELOAD_KEY = "pickyou.chunk_reload_attempt";

const isChunkLoadError = (error: Error | null): boolean => {
  if (!error) return false;
  const msg = `${error.name} ${error.message}`.toLowerCase();
  return (
    msg.includes("chunkloaderror") ||
    msg.includes("loading chunk") ||
    msg.includes("failed to fetch dynamically imported module") ||
    msg.includes("importing a module script failed") ||
    msg.includes("dynamically imported module")
  );
};

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidMount() {
    // Successful mount → clear the one-shot chunk reload guard so a future
    // stale-chunk error in the same session can auto-recover again.
    try {
      sessionStorage.removeItem(CHUNK_RELOAD_KEY);
    } catch {
      /* ignore */
    }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);

    // Stale chunk after a deploy/HMR update is the most common "Something
    // went wrong" the user sees on the live site. Auto-recover with a single
    // hard reload (guarded by sessionStorage so we never loop).
    //
    // Critical: skip the auto-reload when the user is OFFLINE. Reloading
    // while offline just shows the browser's network-error page, which is a
    // worse UX than the friendly fallback. Instead, wait for the `online`
    // event and then reload once.
    if (isChunkLoadError(error)) {
      try {
        const tried = sessionStorage.getItem(CHUNK_RELOAD_KEY);
        if (tried === "1") return;

        if (typeof navigator !== "undefined" && navigator.onLine === false) {
          const onBackOnline = () => {
            window.removeEventListener("online", onBackOnline);
            try {
              sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
            } catch {
              /* ignore */
            }
            window.location.reload();
          };
          window.addEventListener("online", onBackOnline);
          return;
        }

        sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
        window.location.reload();
      } catch {
        /* ignore storage errors */
      }
    }
  }

  handleReset = () => {
    try {
      sessionStorage.removeItem(CHUNK_RELOAD_KEY);
    } catch {
      /* ignore */
    }
    // A hard reload is much more reliable than just clearing state — it
    // recovers from stale chunks, broken HMR sessions, and React tree
    // corruption that local state-clearing can't fix.
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const chunkError = isChunkLoadError(this.state.error);
      const isOffline = typeof navigator !== "undefined" && navigator.onLine === false;
      const title = isOffline
        ? "You're offline"
        : chunkError
          ? "Update available"
          : "Something went wrong";
      const message = isOffline
        ? "Reconnect to the internet — the page will reload automatically."
        : chunkError
          ? "We just shipped an update. Reloading the page will fix this."
          : "An unexpected error occurred. Please try again.";
      return (
        <div className="min-h-screen flex items-center justify-center bg-background px-4">
          <div className="text-center max-w-md space-y-4">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
            <h1 className="text-xl font-semibold text-foreground">{title}</h1>
            <p className="text-sm text-muted-foreground">{message}</p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={this.handleReset} disabled={isOffline}>
                {chunkError || isOffline ? "Reload" : "Try Again"}
              </Button>
              <Button onClick={() => (window.location.href = "/?view=landing")}>
                Go Home
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
