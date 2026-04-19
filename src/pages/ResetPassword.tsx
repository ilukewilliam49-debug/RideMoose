import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Lock, CheckCircle, Check } from "lucide-react";
import logoImg from "@/assets/logo.png";
import { useTranslation } from "react-i18next";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const [done, setDone] = useState(false);
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
      }
    });

    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setIsRecovery(true);
    }

    return () => subscription.unsubscribe();
  }, []);

  // Same strength rules as signup — never let a reset weaken a password.
  const passwordChecks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
  };
  const passwordScore = Object.values(passwordChecks).filter(Boolean).length;
  const passwordValid = passwordScore === 5;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordValid) {
      toast.error(t("auth.passwordTooWeak", "Password does not meet all requirements"));
      return;
    }
    if (password !== confirmPassword) {
      toast.error(t("auth.passwordMismatch"));
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      toast.success(t("auth.passwordUpdated"));
      setTimeout(() => navigate("/login", { replace: true }), 2000);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isRecovery && !done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md text-center">
          <button type="button" onClick={() => navigate("/")} aria-label="PickYou home" className="block mx-auto mb-6 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <img src={logoImg} alt="PickYou" className="h-12 rounded mx-auto" />
          </button>
          <p className="text-muted-foreground">{t("auth.invalidResetLink")}</p>
          <Button className="mt-4" onClick={() => navigate("/login")}>
            {t("auth.backToLogin")}
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="text-center mb-8">
          <button type="button" onClick={() => navigate("/")} aria-label="PickYou home" className="block mx-auto mb-4 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <img src={logoImg} alt="PickYou" className="h-12 rounded mx-auto" />
          </button>
          <p className="text-muted-foreground">{t("auth.setNewPassword")}</p>
        </div>

        {done ? (
          <div className="glass-surface rounded-lg p-6 text-center space-y-4">
            <CheckCircle className="h-12 w-12 text-primary mx-auto" />
            <p className="font-medium">{t("auth.passwordUpdated")}</p>
            <p className="text-sm text-muted-foreground">{t("auth.redirectingToLogin")}</p>
          </div>
        ) : (
          <div className="glass-surface rounded-lg p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">{t("auth.newPassword")}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="new-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 bg-secondary border-border"
                    autoComplete="new-password"
                    required
                    minLength={8}
                  />
                </div>
                {password.length > 0 && (
                  <ul className="space-y-1 text-xs pt-1">
                    {[
                      { ok: passwordChecks.length, label: t("auth.passwordMinLength", "At least 8 characters") },
                      { ok: passwordChecks.uppercase, label: t("auth.passwordUppercase", "One uppercase letter") },
                      { ok: passwordChecks.lowercase, label: t("auth.passwordLowercase", "One lowercase letter") },
                      { ok: passwordChecks.number, label: t("auth.passwordNumber", "One number") },
                      { ok: passwordChecks.symbol, label: t("auth.passwordSymbol", "One symbol (!@#$…)") },
                    ].map((rule, i) => (
                      <li
                        key={i}
                        className={`flex items-center gap-2 ${rule.ok ? "text-green-500" : "text-muted-foreground"}`}
                      >
                        {rule.ok ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 ml-1" />
                        )}
                        {rule.label}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">{t("auth.confirmPassword")}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10 bg-secondary border-border"
                    autoComplete="new-password"
                    required
                    minLength={8}
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading || !passwordValid || password !== confirmPassword}>
                {loading ? t("auth.loading") : t("auth.updatePassword")}
              </Button>
            </form>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default ResetPassword;
