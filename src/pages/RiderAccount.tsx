import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogOut, ChevronRight, Phone, Check } from "lucide-react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import NotificationBell from "@/components/NotificationBell";
import { toast } from "sonner";

const RiderAccount = () => {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [riderPhone, setRiderPhone] = useState(profile?.phone || "");
  const [phoneSaving, setPhoneSaving] = useState(false);
  const [phoneEditing, setPhoneEditing] = useState(false);
  const [smsEnabled, setSmsEnabled] = useState(
    (profile as any)?.sms_notifications_enabled ?? true
  );

  useEffect(() => {
    if (profile?.phone) setRiderPhone(profile.phone);
    if ((profile as any)?.sms_notifications_enabled !== undefined)
      setSmsEnabled((profile as any).sms_notifications_enabled);
  }, [profile?.phone, (profile as any)?.sms_notifications_enabled]);

  const initials = profile?.full_name
    ? profile.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  const handleSavePhone = async () => {
    if (!profile?.id || !riderPhone.trim()) return;
    setPhoneSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ phone: riderPhone.trim() })
      .eq("id", profile.id);
    setPhoneSaving(false);
    if (error) {
      toast.error(t("rider.phoneSaveError"));
    } else {
      toast.success(t("rider.phoneSaved"));
      setPhoneEditing(false);
    }
  };

  const handleToggleSms = async (checked: boolean) => {
    setSmsEnabled(checked);
    if (!profile?.id) return;
    const { error } = await supabase
      .from("profiles")
      .update({ sms_notifications_enabled: checked })
      .eq("id", profile.id);
    if (error) {
      toast.error("Failed to update SMS preference");
      setSmsEnabled(!checked);
    }
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Profile header */}
      <div className="flex items-center gap-4">
        <Avatar className="h-14 w-14">
          <AvatarFallback className="bg-primary/20 text-primary text-lg font-bold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-lg font-bold truncate">
            {profile?.full_name || "User"}
          </p>
          <p className="text-sm text-muted-foreground capitalize">
            {profile?.role || "rider"}
          </p>
        </div>
        <NotificationBell />
      </div>

      {/* Phone number management */}
      <div className="space-y-3 rounded-xl border border-border/40 p-4">
        <Label className="text-sm font-semibold flex items-center gap-2">
          <Phone className="h-4 w-4" />
          {t("rider.addPhoneTitle")}
        </Label>

        {!profile?.phone || phoneEditing ? (
          <div className="flex gap-2">
            <Input
              type="tel"
              placeholder={t("rider.phonePlaceholder")}
              value={riderPhone}
              onChange={(e) => setRiderPhone(e.target.value)}
              className="flex-1"
            />
            <Button
              size="sm"
              onClick={handleSavePhone}
              disabled={phoneSaving || !riderPhone.trim()}
            >
              {phoneSaving ? "…" : <Check className="h-4 w-4" />}
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {profile.phone}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPhoneEditing(true)}
            >
              {t("rider.editPhone", "Edit")}
            </Button>
          </div>
        )}

        {profile?.phone && !phoneEditing && (
          <div className="flex items-center justify-between pt-1">
            <Label htmlFor="sms-toggle" className="text-sm">
              {t("rider.smsNotifications")}
            </Label>
            <Switch
              id="sms-toggle"
              checked={smsEnabled}
              onCheckedChange={handleToggleSms}
            />
          </div>
        )}
      </div>

      {/* Navigation links */}
      <div className="space-y-1">
        <button
          onClick={() => navigate("/rider/corporate-apply")}
          className="flex w-full items-center justify-between rounded-xl px-4 py-3.5 text-left hover:bg-accent/30 transition-colors"
        >
          <span className="text-[15px] font-semibold">
            {t("nav.corporate")}
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
        </button>
      </div>

      {/* Settings */}
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
