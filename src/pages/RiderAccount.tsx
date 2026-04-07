import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogOut, ChevronRight } from "lucide-react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import NotificationBell from "@/components/NotificationBell";

const RiderAccount = () => {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const initials = profile?.full_name
    ? profile.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-center gap-4">
        <Avatar className="h-14 w-14">
          <AvatarFallback className="bg-primary/20 text-primary text-lg font-bold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-lg font-bold truncate">{profile?.full_name || "User"}</p>
          <p className="text-sm text-muted-foreground capitalize">{profile?.role || "rider"}</p>
        </div>
        <NotificationBell />
      </div>

      <div className="space-y-1">
        <button
          onClick={() => navigate("/rider/corporate-apply")}
          className="flex w-full items-center justify-between rounded-xl px-4 py-3.5 text-left hover:bg-accent/30 transition-colors"
        >
          <span className="text-[15px] font-semibold">{t("nav.corporate")}</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
        </button>
      </div>

      <div className="space-y-2 pt-2">
        <LanguageSwitcher />
        <Button
          variant="outline"
          className="w-full justify-start gap-3 h-12 rounded-xl text-destructive hover:text-destructive"
          onClick={async () => {
            await signOut();
            navigate("/login");
          }}
        >
          <LogOut className="h-4 w-4" />
          {t("nav.signOut")}
        </Button>
      </div>
    </div>
  );
};

export default RiderAccount;
