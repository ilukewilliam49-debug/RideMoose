import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Mail } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import ForgotPasswordDialog from "@/components/ForgotPasswordDialog";

interface SessionExpiredDialogProps {
  open: boolean;
  email?: string;
  onSuccess: () => void;
  onSwitchAccount: () => void;
}

const SessionExpiredDialog = ({ open, email: prefillEmail, onSuccess, onSwitchAccount }: SessionExpiredDialogProps) => {
  const [email, setEmail] = useState(prefillEmail || "");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const { t } = useTranslation();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success(t("auth.welcomeBack"));
      setPassword("");
      onSuccess();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-center">Session Expired</DialogTitle>
          <DialogDescription className="text-center">
            Your session has expired. Please sign in again to continue.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleLogin} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="session-email">{t("auth.email")}</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="session-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10 bg-secondary border-border"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="session-password">{t("auth.password")}</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="session-password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 bg-secondary border-border"
                required
              />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? t("auth.loading") : t("auth.signIn")}
          </Button>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setForgotOpen(true)}
              className="w-full text-sm text-muted-foreground hover:text-primary transition-colors text-center"
            >
              {t("auth.forgotPassword")}
            </button>
            <button
              type="button"
              onClick={onSwitchAccount}
              className="w-full text-sm text-muted-foreground hover:text-primary transition-colors text-center"
            >
              {t("auth.switchAccount")}
            </button>
          </div>
        </form>
        <ForgotPasswordDialog open={forgotOpen} onOpenChange={setForgotOpen} prefillEmail={email} />
      </DialogContent>
    </Dialog>
  );
};

export default SessionExpiredDialog;
