import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, LogOut } from "lucide-react";
import { motion } from "framer-motion";
import logoImg from "@/assets/logo.png";

const DriverOnboardingPending = () => {
  const { signOut } = useAuth();

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden"
      style={{
        background: "linear-gradient(180deg, hsl(220 30% 10%), hsl(220 30% 6%))",
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 40%, hsl(45 95% 55% / 0.06) 0%, transparent 70%)",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md text-center"
      >
        <img
          src={logoImg}
          alt="PickYou"
          className="h-16 mx-auto rounded-xl mb-6 drop-shadow-[0_0_12px_hsl(var(--primary)/0.4)]"
        />

        <Card
          className="border-border/50 backdrop-blur-xl"
          style={{
            background:
              "linear-gradient(135deg, hsl(220 28% 14% / 0.8), hsl(220 30% 10% / 0.9))",
            boxShadow:
              "0 0 40px -10px hsl(45 95% 55% / 0.12), 0 4px 24px -4px hsl(0 0% 0% / 0.4), inset 0 1px 0 0 hsl(0 0% 100% / 0.05)",
          }}
        >
          <CardContent className="pt-6 space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Clock className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-xl font-semibold text-foreground">
              Application Under Review
            </h1>
            <p className="text-sm text-muted-foreground">
              Your documents have been submitted and are being reviewed by our team.
              You'll receive a notification once your account is approved.
            </p>
            <Button variant="outline" onClick={signOut} className="mt-4">
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default DriverOnboardingPending;
