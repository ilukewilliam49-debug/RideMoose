import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import OfflineIndicator from "@/components/OfflineIndicator";
import logoImg from "@/assets/logo.png";
import LaunchingSoonBanner from "@/components/landing/LaunchingSoonBanner";
import type { LandingTab } from "@/components/landing/LandingHero";

const readTabFromHash = (): LandingTab => {
  if (typeof window === "undefined") return "ride";
  const h = window.location.hash.replace("#", "");
  if (h === "drive" || h === "business") return h;
  return "ride";
};

const LandingNav = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [tab, setTab] = useState<LandingTab>(readTabFromHash);

  useEffect(() => {
    const onHash = () => setTab(readTabFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const selectTab = (next: LandingTab) => {
    setTab(next);
    if (typeof window !== "undefined") {
      window.location.hash = next === "ride" ? "" : next;
      // Ensure a hashchange event fires when clearing the hash
      if (next === "ride") {
        window.dispatchEvent(new HashChangeEvent("hashchange"));
      }
    }
  };

  const tabs: Array<{ id: LandingTab; label: string }> = [
    { id: "ride", label: t("nav.ride") },
    { id: "drive", label: t("nav.drive") },
    { id: "business", label: t("nav.business") },
  ];

  return (
    <nav className="sticky top-0 z-[600] border-b border-border/40 bg-background/85 backdrop-blur-xl pt-[env(safe-area-inset-top)]">
      <LaunchingSoonBanner />
      <div className="mx-auto max-w-7xl px-4 sm:px-5 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-3">
          {/* Left — Logo */}
          <button
            onClick={() => navigate("/")}
            className="flex items-center shrink-0"
            aria-label="PickYou home"
          >
            <img
              src={logoImg}
              alt="PickYou — Yellowknife taxi and transportation"
              className="h-7 object-contain"
            />
          </button>

          {/* Center — Segmented tab control */}
          <div
            role="tablist"
            aria-label="Service mode"
            className="flex items-center gap-1 rounded-full bg-muted/60 p-1 ring-1 ring-border/30"
          >
            {tabs.map((tabItem) => {
              const active = tab === tabItem.id;
              return (
                <button
                  key={tabItem.id}
                  role="tab"
                  aria-selected={active}
                  onClick={() => selectTab(tabItem.id)}
                  className={[
                    "rounded-full px-3 py-1.5 text-xs font-bold transition sm:px-4 sm:text-sm",
                    active
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  ].join(" ")}
                >
                  {tabItem.label}
                </button>
              );
            })}
          </div>

          {/* Right — language + signup */}
          <div className="flex items-center gap-1.5 shrink-0">
            <OfflineIndicator />
            <LanguageSwitcher collapsed />
            <Button
              size="sm"
              className="rounded-full px-3 text-xs font-bold sm:px-5"
              onClick={() => navigate("/login")}
            >
              {t("nav.signUp")}
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default LandingNav;
