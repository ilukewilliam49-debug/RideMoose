import { useState, useEffect, useCallback } from "react";
import { Download, X, Share, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) &&
  !(window as any).MSStream;

const isAndroid = () => /android/i.test(navigator.userAgent);

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as any).standalone === true;

export default function InstallAppPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (isStandalone()) {
      setInstalled(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const installedHandler = () => setInstalled(true);

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installedHandler);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") setInstalled(true);
      setDeferredPrompt(null);
    } else {
      setShowManual(true);
    }
  }, [deferredPrompt]);

  if (installed || dismissed) return null;

  // Show if: mobile device OR desktop with install prompt available
  const canShow = isIOS() || isAndroid() || !!deferredPrompt;
  if (!canShow) return null;

  return (
    <>
      {/* Install banner */}
      <div className="fixed bottom-20 left-3 right-3 z-[1100] animate-in slide-in-from-bottom-4 duration-300 sm:left-auto sm:right-4 sm:max-w-sm">
        <div className="rounded-2xl border border-border/50 bg-card/95 p-4 shadow-xl backdrop-blur-lg">
          <button
            onClick={() => setDismissed(true)}
            className="absolute right-3 top-3 p-1 text-muted-foreground"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary">
              <Download className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">
                Install PickYou
              </p>
              <p className="text-xs text-muted-foreground">
                Add to your home screen for the best experience
              </p>
            </div>
          </div>

          <Button
            onClick={handleInstall}
            className="mt-3 w-full"
            size="sm"
          >
            <Download className="mr-2 h-4 w-4" />
            Install PickYou
          </Button>
        </div>
      </div>

      {/* Manual instructions sheet */}
      {showManual && (
        <div
          className="fixed inset-0 z-[1300] flex items-end justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowManual(false)}
        >
          <div
            className="w-full max-w-md animate-in slide-in-from-bottom duration-300 rounded-t-2xl bg-card p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted" />
            <h3 className="mb-4 text-center text-lg font-semibold text-foreground">
              Install PickYou
            </h3>

            {isIOS() ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    1
                  </div>
                  <p className="pt-1 text-sm text-foreground">
                    Tap the{" "}
                    <Share className="inline h-4 w-4 text-primary" />{" "}
                    <strong>Share</strong> button in Safari
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    2
                  </div>
                  <p className="pt-1 text-sm text-foreground">
                    Scroll down and tap{" "}
                    <strong>"Add to Home Screen"</strong>
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    3
                  </div>
                  <p className="pt-1 text-sm text-foreground">
                    Tap <strong>"Add"</strong> to install
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    1
                  </div>
                  <p className="pt-1 text-sm text-foreground">
                    Tap the{" "}
                    <MoreVertical className="inline h-4 w-4 text-primary" />{" "}
                    <strong>menu</strong> in your browser
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    2
                  </div>
                  <p className="pt-1 text-sm text-foreground">
                    Tap <strong>"Install App"</strong> or{" "}
                    <strong>"Add to Home Screen"</strong>
                  </p>
                </div>
              </div>
            )}

            <Button
              variant="outline"
              className="mt-6 w-full"
              onClick={() => setShowManual(false)}
            >
              Got it
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
