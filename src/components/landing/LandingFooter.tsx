import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import logoImg from "@/assets/logo.png";

const LandingFooter = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <footer className="border-t border-border/30 bg-card/30">
      <div className="mx-auto max-w-7xl px-5 lg:px-8 py-12 md:py-16">
        <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-4">
          {/* Brand */}
          <div className="space-y-3">
            <img src={logoImg} alt="PickYou logo — Yellowknife transportation platform" className="h-7 object-contain" />
            <p className="text-xs leading-relaxed text-muted-foreground max-w-[200px]">
              {t("landing.heroDesc", "Your Ride. Your Choice. Smarter rides, better connections.")}
            </p>
          </div>

          {/* Company */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Company</h4>
            <div className="flex flex-col gap-2">
              <button onClick={() => navigate("/terms")} className="text-sm text-foreground/70 hover:text-foreground text-left transition-colors">
                Terms of Service
              </button>
              <button onClick={() => navigate("/privacy")} className="text-sm text-foreground/70 hover:text-foreground text-left transition-colors">
                Privacy Policy
              </button>
              <button onClick={() => navigate("/rider/corporate-apply")} className="text-sm text-foreground/70 hover:text-foreground text-left transition-colors">
                Business
              </button>
            </div>
          </div>

          {/* Products */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Products</h4>
            <div className="flex flex-col gap-2">
              <button onClick={() => navigate("/login")} className="text-sm text-foreground/70 hover:text-foreground text-left transition-colors">Ride</button>
              <button onClick={() => navigate("/login?role=driver")} className="text-sm text-foreground/70 hover:text-foreground text-left transition-colors">Drive</button>
              <button onClick={() => navigate("/login")} className="text-sm text-foreground/70 hover:text-foreground text-left transition-colors">Courier</button>
            </div>
          </div>

          {/* Contact */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Contact</h4>
            <div className="flex flex-col gap-2">
              <a
                href="tel:+18679888836"
                className="text-sm text-foreground/70 hover:text-foreground transition-colors"
              >
                (867) 988-8836
              </a>
              <span className="text-xs text-muted-foreground">
                Yellowknife, NT, Canada
              </span>
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-border/20">
          <p className="text-xs text-muted-foreground/60">
            {t("landing.footer")}
          </p>
        </div>
      </div>
    </footer>
  );
};

export default LandingFooter;
