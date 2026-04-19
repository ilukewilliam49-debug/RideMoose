import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import logoImg from "@/assets/logo.png";

const LandingFooter = () => {
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
            <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("landing.footerCompany")}</h4>
            <div className="flex flex-col gap-2">
              <Link to="/terms" className="text-sm text-foreground/70 hover:text-foreground transition-colors">
                {t("landing.footerTerms")}
              </Link>
              <Link to="/privacy" className="text-sm text-foreground/70 hover:text-foreground transition-colors">
                {t("landing.footerPrivacy")}
              </Link>
              <Link to="/business" className="text-sm text-foreground/70 hover:text-foreground transition-colors">
                {t("landing.footerBusiness")}
              </Link>
            </div>
          </div>

          {/* Products */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("landing.footerProducts")}</h4>
            <div className="flex flex-col gap-2">
              <Link to="/login" className="text-sm text-foreground/70 hover:text-foreground transition-colors">{t("landing.footerRide")}</Link>
              <Link to="/drive" className="text-sm text-foreground/70 hover:text-foreground transition-colors">{t("landing.footerDrive")}</Link>
              <Link to="/login" className="text-sm text-foreground/70 hover:text-foreground transition-colors">{t("landing.footerCourier")}</Link>
            </div>
          </div>

          {/* Contact */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("landing.footerContact")}</h4>
            <div className="flex flex-col gap-2">
              <a
                href="tel:+18679888836"
                className="text-sm text-foreground/70 hover:text-foreground transition-colors"
              >
                (867) 988-8836
              </a>
              <span className="text-xs text-muted-foreground">
                {t("landing.footerLocation")}
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
