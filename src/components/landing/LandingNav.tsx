import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import OfflineIndicator from "@/components/OfflineIndicator";
import { ChevronDown } from "lucide-react";
import logoImg from "@/assets/logo.png";
import LaunchingSoonBanner from "@/components/landing/LaunchingSoonBanner";

const LandingNav = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <nav className="sticky top-0 z-50 border-b border-border/40 bg-background/95 backdrop-blur-xl pt-[env(safe-area-inset-top)]">
      <LaunchingSoonBanner />
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-5 lg:px-8">
        {/* Left: logo + desktop links */}
        <div className="flex items-center gap-6 md:gap-8 min-w-0">
          <button
            onClick={() => navigate("/")}
            className="flex items-center shrink-0"
            aria-label="PickYou home"
          >
            <img src={logoImg} alt="PickYou — Yellowknife taxi and transportation" className="h-7 object-contain" />
          </button>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-1">
            <button
              onClick={() => navigate("/login")}
              className="px-3.5 py-2 text-sm font-medium text-foreground/80 hover:text-foreground rounded-lg transition-colors"
            >
              {t("nav.ride")}
            </button>
            <button
              onClick={() => navigate("/drive")}
              className="flex items-center gap-1 px-3.5 py-2 text-sm font-medium text-foreground/80 hover:text-foreground rounded-lg transition-colors"
            >
              {t("nav.drive")}
            </button>
            <button
              onClick={() => navigate("/business")}
              className="px-3.5 py-2 text-sm font-medium text-foreground/80 hover:text-foreground rounded-lg transition-colors"
            >
              {t("nav.business")}
            </button>
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <OfflineIndicator />
          <div className="hidden sm:block">
            <LanguageSwitcher />
          </div>
          <LanguageSwitcher collapsed className="sm:hidden" />
          <Button
            variant="ghost"
            size="sm"
            className="hidden md:inline-flex text-sm font-medium"
            onClick={() => navigate("/login")}
          >
            {t("nav.signIn")}
          </Button>
          <Button
            size="sm"
            className="rounded-full px-4 sm:px-5 text-xs font-bold"
            onClick={() => navigate("/login")}
          >
            {t("nav.signUp")}
          </Button>
        </div>
      </div>
    </nav>
  );
};

export default LandingNav;
