import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Package, MapPin, Camera, ShieldCheck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import LandingNav from "@/components/landing/LandingNav";
import LandingFooter from "@/components/landing/LandingFooter";

const CourierInfo = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
    const prevTitle = document.title;
    document.title = "Courier & Package Delivery in Yellowknife | PickYou";
    return () => { document.title = prevTitle; };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <LandingNav />

      <main className="mx-auto max-w-5xl px-5 lg:px-8 py-12 md:py-20">
        <section className="text-center space-y-4 mb-12">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 mb-2">
            <Package className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            Send a package across Yellowknife
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Same-day courier service powered by local PickYou drivers. From documents to small parcels — book in seconds.
          </p>
          <div className="pt-2">
            <Button asChild size="lg">
              <Link to="/login?intent=courier">
                Request Delivery <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-3 mb-14">
          <Card className="p-6 space-y-2">
            <MapPin className="h-6 w-6 text-primary" />
            <h3 className="font-bold">Live tracking</h3>
            <p className="text-sm text-muted-foreground">Watch your driver in real-time from pickup to drop-off.</p>
          </Card>
          <Card className="p-6 space-y-2">
            <Camera className="h-6 w-6 text-primary" />
            <h3 className="font-bold">Proof of delivery</h3>
            <p className="text-sm text-muted-foreground">Every drop-off includes a photo confirmation.</p>
          </Card>
          <Card className="p-6 space-y-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            <h3 className="font-bold">Vetted drivers</h3>
            <p className="text-sm text-muted-foreground">Background-checked local couriers you can trust.</p>
          </Card>
        </section>

        <section>
          <Card className="p-6 md:p-8">
            <h2 className="text-2xl font-bold mb-4">Pricing</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Base fare</p>
                <p className="text-2xl font-bold">$8.00</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Per kilometre</p>
                <p className="text-2xl font-bold">$1.50</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Minimum</p>
                <p className="text-2xl font-bold">$12.00</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Final price is calculated at booking based on actual pickup and drop-off locations. 5% GST applies.
            </p>
          </Card>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
};

export default CourierInfo;
