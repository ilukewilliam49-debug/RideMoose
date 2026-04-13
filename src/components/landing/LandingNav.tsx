import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ChevronDown } from "lucide-react";

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
            <span className="text-lg font-black tracking-tight">
              Pick<span className="text-primary">You</span>
            </span>
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
              onClick={() => navigate("/corporate-apply")}
              className="px-3.5 py-2 text-sm font-medium text-foreground/80 hover:text-foreground rounded-lg transition-colors"
            >
              Business
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
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
