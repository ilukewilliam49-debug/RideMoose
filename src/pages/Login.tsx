import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, User, Car, ArrowLeft, Phone } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import logoImg from "@/assets/logo.png";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import ForgotPasswordDialog from "@/components/ForgotPasswordDialog";

type AuthView = "main" | "email" | "phone-otp";

const Login = () => {
  const [searchParams] = useSearchParams();
  const preselectedRole = searchParams.get("role") === "driver" ? "driver" : "rider";
  const preselectedSignup = searchParams.get("role") === "driver";

  const [view, setView] = useState<AuthView>("main");
  const [isLogin, setIsLogin] = useState(!preselectedSignup);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"rider" | "driver">(preselectedRole);
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Phone OTP state
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);

  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();
  const { t } = useTranslation();

  useEffect(() => {
    if (!authLoading && user && profile) {
      const route = profile.role === "admin" ? "/admin" : profile.role === "driver" ? "/driver" : "/rider";
      navigate(route, { replace: true });
    }
  }, [user, profile, authLoading, navigate]);

  const formatPhone = (raw: string) => {
    const digits = raw.replace(/\D/g, "");
    return digits.startsWith("1") ? `+${digits}` : `+1${digits}`;
  };

  const handlePhoneContinue = async () => {
    if (!phoneNumber.trim()) return;
    setLoading(true);
    try {
      const phone = formatPhone(phoneNumber);
      const res = await supabase.functions.invoke("send-login-otp", {
        body: { phone },
      });
      if (res.error) throw new Error(res.error.message || "Failed to send code");
      const data = res.data as any;
      if (data?.error) throw new Error(data.error);
      setOtpSent(true);
      setView("phone-otp");
      toast.success(t("auth.otpSent", "Verification code sent!"));
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode.trim()) return;
    setLoading(true);
    try {
      const phone = formatPhone(phoneNumber);
      const res = await supabase.functions.invoke("verify-login-otp", {
        body: { phone, otp: otpCode },
      });
      if (res.error) throw new Error(res.error.message || "Verification failed");
      const data = res.data as any;
      if (data?.error) throw new Error(data.error);
      if (data?.session) {
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
        toast.success(t("auth.welcomeBack"));
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success(t("auth.welcomeBack"));
      } else {
        if (!agreedToTerms) {
          toast.error(t("auth.mustAgreeToTerms", "You must agree to the Terms of Service"));
          setLoading(false);
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName, role },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        if (data.session) {
          toast.success(t("auth.accountCreated"));
        } else {
          toast.success(t("auth.checkEmail"));
        }
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: "google" | "apple") => {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: window.location.origin,
        extraParams: !isLogin && role === "driver" ? { role: "driver" } : undefined,
      });

      if (result.error) {
        toast.error((result.error as Error).message || "Sign-in failed");
        return;
      }

      if (result.redirected) {
        // Browser will redirect to OAuth provider
        return;
      }

      // Tokens received and session set — user is authenticated
      toast.success(t("auth.welcomeBack"));
    } catch (err: any) {
      toast.error(err.message || "Sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  const Divider = () => (
    <div className="relative flex items-center justify-center my-4">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-border" />
      </div>
      <span className="relative bg-background px-4 text-xs text-muted-foreground">
        {t("auth.or", "or")}
      </span>
    </div>
  );

  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-6">
        <img src={logoImg} alt="PickYou" className="h-16 rounded-xl object-contain animate-pulse" />
        <div className="w-full max-w-sm space-y-4 px-6">
          <div className="h-8 w-3/4 mx-auto rounded-lg bg-muted animate-pulse" />
          <div className="h-12 w-full rounded-xl bg-muted animate-pulse" />
          <div className="h-12 w-full rounded-xl bg-muted animate-pulse" />
          <div className="h-12 w-full rounded-xl bg-muted animate-pulse" />
          <div className="h-12 w-full rounded-xl bg-muted animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-4">
        {view !== "main" ? (
          <button
            onClick={() => { setView("main"); setOtpSent(false); setOtpCode(""); }}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("common.back", "Back")}
          </button>
        ) : (
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("common.back", "Back")}
          </button>
        )}
        <LanguageSwitcher />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <img
              src={logoImg}
              alt="PickYou"
              className="h-16 rounded-xl object-contain"
            />
          </div>

          <h1 className="text-2xl font-bold text-center mb-8 text-foreground">
            {t("auth.getStarted", "Get started with PickYou")}
          </h1>

          <AnimatePresence mode="wait">
            {/* ── MAIN VIEW ── */}
            {view === "main" && (
              <motion.div
                key="main"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-3"
              >
                {/* Phone input */}
                <div>
                  <Label className="text-sm font-medium mb-1.5 block">
                    {t("auth.mobileNumber", "Mobile number")}
                  </Label>
                  <div className="flex gap-2">
                    <div className="flex items-center gap-1.5 px-3 rounded-lg border border-input bg-secondary text-sm min-w-[80px] justify-center">
                      <span className="text-base">🇨🇦</span>
                      <span className="text-muted-foreground">+1</span>
                    </div>
                    <Input
                      type="tel"
                      placeholder="(867) 446-4151"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="flex-1 bg-secondary border-input"
                    />
                  </div>
                </div>

                <Button
                  className="w-full h-12 rounded-xl text-base font-semibold"
                  disabled={loading || !phoneNumber.trim()}
                  onClick={handlePhoneContinue}
                >
                  {loading ? t("auth.loading") : t("auth.continue", "Continue")}
                </Button>

                <Divider />

                {/* Apple */}
                <Button
                  variant="secondary"
                  className="w-full h-12 rounded-xl text-base font-medium justify-center gap-3"
                  disabled={loading}
                  onClick={() => handleOAuth("apple")}
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                  </svg>
                  {t("auth.continueWithApple", "Continue with Apple")}
                </Button>

                {/* Google */}
                <Button
                  variant="secondary"
                  className="w-full h-12 rounded-xl text-base font-medium justify-center gap-3"
                  disabled={loading}
                  onClick={() => handleOAuth("google")}
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  {t("auth.continueWithGoogle", "Continue with Google")}
                </Button>

                {/* Email */}
                <Button
                  variant="secondary"
                  className="w-full h-12 rounded-xl text-base font-medium justify-center gap-3"
                  disabled={loading}
                  onClick={() => setView("email")}
                >
                  <Mail className="h-5 w-5" />
                  {t("auth.continueWithEmail", "Continue with Email")}
                </Button>

                <Divider />

                {/* Find my account / Forgot password */}
                <button
                  type="button"
                  onClick={() => setForgotOpen(true)}
                  className="flex items-center justify-center gap-2 w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"/>
                    <path d="m21 21-4.3-4.3"/>
                  </svg>
                  {t("auth.findMyAccount", "Find my account")}
                </button>

                {/* Terms notice */}
                <p className="text-xs text-muted-foreground text-center leading-relaxed pt-2">
                  {t("auth.byContinuing", "By continuing, you agree to the")}{" "}
                  <a href="/terms" target="_blank" className="underline hover:text-foreground">
                    {t("auth.termsOfService", "Terms of Service")}
                  </a>{" "}
                  {t("common.and", "and")}{" "}
                  <a href="/privacy" target="_blank" className="underline hover:text-foreground">
                    {t("auth.privacyPolicy", "Privacy Policy")}
                  </a>
                  {" "}{t("auth.fromPickYou", "from PickYou.")}
                </p>
              </motion.div>
            )}

            {/* ── PHONE OTP VIEW ── */}
            {view === "phone-otp" && (
              <motion.div
                key="otp"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <p className="text-sm text-muted-foreground text-center mb-2">
                  {t("auth.codeSentTo", "We sent a code to")} <strong>{formatPhone(phoneNumber)}</strong>
                </p>
                <Label>{t("auth.enterOtp", "Enter verification code")}</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                  className="text-center text-2xl tracking-[0.5em] bg-secondary border-input"
                  autoFocus
                />
                <Button
                  className="w-full h-12 rounded-xl text-base font-semibold"
                  disabled={loading || otpCode.length < 6}
                  onClick={handleVerifyOtp}
                >
                  {loading ? t("auth.loading") : t("auth.verify", "Verify")}
                </Button>
                <button
                  type="button"
                  onClick={() => { setOtpSent(false); setOtpCode(""); handlePhoneContinue(); }}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors w-full text-center"
                  disabled={loading}
                >
                  {t("auth.resendCode", "Resend code")}
                </button>
              </motion.div>
            )}

            {/* ── EMAIL VIEW ── */}
            {view === "email" && (
              <motion.div
                key="email"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <form onSubmit={handleEmailSubmit} className="space-y-4">
                  {!isLogin && (
                    <>
                      <div className="space-y-1.5">
                        <Label htmlFor="name">{t("auth.fullName")}</Label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="name"
                            placeholder="John Doe"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            className="pl-10 bg-secondary border-input"
                            required
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label>{t("auth.selectRole")}</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setRole("rider")}
                            className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all ${
                              role === "rider"
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-input bg-secondary text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            <User className="h-4 w-4" />
                            {t("auth.rider")}
                          </button>
                          <button
                            type="button"
                            onClick={() => setRole("driver")}
                            className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all ${
                              role === "driver"
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-input bg-secondary text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            <Car className="h-4 w-4" />
                            {t("auth.driver")}
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                  <div className="space-y-1.5">
                    <Label htmlFor="email">{t("auth.email")}</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10 bg-secondary border-input"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="password">{t("auth.password")}</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10 bg-secondary border-input"
                        required
                        minLength={6}
                      />
                    </div>
                  </div>
                  {!isLogin && (
                    <div className="flex items-start gap-2">
                      <Checkbox
                        id="terms"
                        checked={agreedToTerms}
                        onCheckedChange={(checked) => setAgreedToTerms(checked === true)}
                        className="mt-0.5"
                      />
                      <label htmlFor="terms" className="text-sm text-muted-foreground leading-tight cursor-pointer">
                        {t("auth.agreeToTerms", "I agree to the")}{" "}
                        <a href="/terms" target="_blank" className="text-primary hover:underline">
                          {t("auth.termsOfService", "Terms of Service")}
                        </a>{" "}
                        {t("common.and", "and")}{" "}
                        <a href="/privacy" target="_blank" className="text-primary hover:underline">
                          {t("auth.privacyPolicy", "Privacy Policy")}
                        </a>
                      </label>
                    </div>
                  )}
                  <Button
                    type="submit"
                    className="w-full h-12 rounded-xl text-base font-semibold"
                    disabled={loading || (!isLogin && !agreedToTerms)}
                  >
                    {loading ? t("auth.loading") : isLogin ? t("auth.signIn") : t("auth.signUp")}
                  </Button>
                </form>

                <div className="mt-4 text-center space-y-2">
                  {isLogin && (
                    <button
                      type="button"
                      onClick={() => setForgotOpen(true)}
                      className="text-sm text-muted-foreground hover:text-primary transition-colors block w-full"
                    >
                      {t("auth.forgotPassword")}
                    </button>
                  )}
                  <button
                    onClick={() => setIsLogin(!isLogin)}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    {isLogin ? t("auth.noAccount") : t("auth.hasAccount")}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      <ForgotPasswordDialog open={forgotOpen} onOpenChange={setForgotOpen} prefillEmail={email} />
    </div>
  );
};

export default Login;
