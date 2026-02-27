import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Zap, Shield, MapPin } from "lucide-react";
import logoImg from "@/assets/logo.png";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 glass-surface">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <div className="flex items-center gap-2">
            <img src={logoImg} alt="OnlyKnifers" className="h-8 rounded" />
            <span className="text-lg font-bold text-gradient-gold">OnlyKnifers</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/login")}>
            Sign In
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4">
        <div className="container mx-auto text-center max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-5xl md:text-7xl font-black mb-6 leading-tight">
              Cut Through <br />
              <span className="text-gradient-gold">The Traffic</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-xl mx-auto">
              Lightning-fast dispatch. Real-time tracking. Razor-sharp precision for every ride.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                className="text-lg px-8 animate-pulse-glow"
                onClick={() => navigate("/login")}
              >
                Request a Ride
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="text-lg px-8"
                onClick={() => navigate("/login")}
              >
                Drive with Us
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              {
                icon: Zap,
                title: "Instant Dispatch",
                desc: "Our automated engine matches you with the nearest available driver in seconds.",
              },
              {
                icon: MapPin,
                title: "Real-Time Tracking",
                desc: "Follow your driver's location from pickup to dropoff with live updates.",
              },
              {
                icon: Shield,
                title: "Verified Drivers",
                desc: "Every driver passes our rigorous verification process before hitting the road.",
              },
            ].map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.1 }}
                className="glass-surface rounded-lg p-6 text-center"
              >
                <feature.icon className="h-10 w-10 text-primary mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4">
        <div className="container mx-auto text-center text-sm text-muted-foreground">
          © 2026 OnlyKnifers. All rights reserved.
        </div>
      </footer>
    </div>
  );
};

export default Index;
