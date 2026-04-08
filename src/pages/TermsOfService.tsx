import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const TermsOfService = () => {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Terms of Service | PickYou";
    const setMeta = (name: string, content: string) => {
      let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
      if (!el) { el = document.createElement("meta"); el.name = name; document.head.appendChild(el); }
      el.content = content;
    };
    setMeta("description", "Read the PickYou Terms of Service covering account usage, payments, cancellations, and liability.");
    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) { link = document.createElement("link"); link.rel = "canonical"; document.head.appendChild(link); }
    link.href = "https://ridemoose.com/terms";
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="sticky top-0 z-50 bg-background/95 backdrop-blur-xl border-b border-border/30">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-5">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-base font-bold">Terms of Service</h1>
        </div>
      </nav>

      <article className="prose prose-sm dark:prose-invert mx-auto max-w-3xl px-5 py-8">
        <p className="text-muted-foreground text-sm">Last updated: April 8, 2026</p>

        <h2>1. Acceptance of Terms</h2>
        <p>By accessing or using the PickYou platform ("Service"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.</p>

        <h2>2. Description of Service</h2>
        <p>PickYou provides a technology platform connecting riders with independent drivers for transportation, courier, and delivery services. PickYou does not provide transportation services directly.</p>

        <h2>3. User Accounts</h2>
        <p>You must provide accurate information when creating an account. You are responsible for maintaining the confidentiality of your credentials and for all activity under your account.</p>

        <h2>4. Acceptable Use</h2>
        <p>You agree not to misuse the Service, including but not limited to: interfering with its operation, using it for unlawful purposes, or attempting to access another user's account.</p>

        <h2>5. Payments & Pricing</h2>
        <p>Fares are calculated based on distance, time, service type, and applicable surcharges. By requesting a ride or delivery, you agree to pay the fare displayed or metered at the time of service.</p>

        <h2>6. Cancellations</h2>
        <p>Cancellation fees may apply if a ride is cancelled after a driver has been dispatched. The fee amount is displayed before confirmation.</p>

        <h2>7. Limitation of Liability</h2>
        <p>To the fullest extent permitted by law, PickYou shall not be liable for indirect, incidental, or consequential damages arising from your use of the Service.</p>

        <h2>8. Changes to Terms</h2>
        <p>We may update these Terms from time to time. Continued use of the Service after changes constitutes acceptance of the revised Terms.</p>

        <h2>9. Contact</h2>
        <p>For questions about these Terms, contact us at <a href="tel:+18679888836" className="text-primary">(867) 988-8836</a>.</p>
      </article>
    </div>
  );
};

export default TermsOfService;
