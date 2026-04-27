import { useEffect } from "react";
import { Phone, MapPin, Heart } from "lucide-react";
import { Card } from "@/components/ui/card";
import LandingNav from "@/components/landing/LandingNav";
import LandingFooter from "@/components/landing/LandingFooter";

const About = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
    const prevTitle = document.title;
    document.title = "About PickYou — Local Yellowknife Transportation";
    return () => { document.title = prevTitle; };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <LandingNav />

      <main className="mx-auto max-w-3xl px-5 lg:px-8 py-12 md:py-20">
        <section className="text-center space-y-4 mb-12">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 mb-2">
            <Heart className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">About PickYou</h1>
          <p className="text-lg text-muted-foreground">Your Ride. Your Choice.</p>
        </section>

        <Card className="p-6 md:p-8 space-y-4 mb-8">
          <h2 className="text-2xl font-bold">Our mission</h2>
          <p className="text-muted-foreground leading-relaxed">
            PickYou is a <strong>local Yellowknife transportation platform</strong> built to connect
            our community with reliable rides and same-day delivery. We partner with licensed taxi
            operators, vetted independent drivers, and local couriers to keep Yellowknife moving —
            day and night, in every season.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            We believe transportation should be transparent, fair, and proudly Northern. Every fare,
            every driver, every kilometre stays in our community.
          </p>
        </Card>

        <Card className="p-6 md:p-8 space-y-4">
          <h2 className="text-2xl font-bold">Get in touch</h2>
          <div className="space-y-3">
            <a
              href="tel:+18679888836"
              className="flex items-center gap-3 text-foreground hover:text-primary transition-colors"
            >
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Phone className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Dispatch</p>
                <p className="text-lg font-semibold">(867) 988-8836</p>
              </div>
            </a>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <MapPin className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Based in</p>
                <p className="text-lg font-semibold">Yellowknife, Northwest Territories</p>
              </div>
            </div>
          </div>
        </Card>
      </main>

      <LandingFooter />
    </div>
  );
};

export default About;
