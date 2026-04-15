import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import OfflineIndicator from "@/components/OfflineIndicator";
import { ChevronDown } from "lucide-react";
import logoImg from "@/assets/logo.png";

const LandingNav = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <nav className="sticky top-0 z-50 border-b border-border/40 bg-background/95 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8">
        <div className="flex items-center gap-8">
          <button
            onClick={() => navigate("/")}
            className="flex items-center"
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
              Ride
            </button>
            <button
              onClick={() => navigate("/login?role=driver")}
              className="flex items-center gap-1 px-3.5 py-2 text-sm font-medium text-foreground/80 hover:text-foreground rounded-lg transition-colors"
            >
              Earn
            </button>
            <button
              onClick={() => navigate("/rider/corporate-apply")}
              className="px-3.5 py-2 text-sm font-medium text-foreground/80 hover:text-foreground rounded-lg transition-colors"
            >
              Business
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <OfflineIndicator />
          <LanguageSwitcher />
          <Button
            variant="ghost"
            size="sm"
            className="hidden sm:inline-flex text-sm font-medium"
            onClick={() => navigate("/login")}
          >
            {t("nav.signIn")}
          </Button>
          <Button
            size="sm"
            className="rounded-full px-5 text-xs font-bold"
            onClick={() => navigate("/login")}
          >
            Sign up
          </Button>
        </div>
      </div>
    </nav>
  );
};

export default LandingNav;
