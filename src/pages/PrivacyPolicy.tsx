import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const PrivacyPolicy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="sticky top-0 z-50 bg-background/95 backdrop-blur-xl border-b border-border/30">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-5">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-base font-bold">Privacy Policy</h1>
        </div>
      </nav>

      <article className="prose prose-sm dark:prose-invert mx-auto max-w-3xl px-5 py-8">
        <p className="text-muted-foreground text-sm">Last updated: April 8, 2026</p>

        <h2>1. Information We Collect</h2>
        <p>We collect information you provide directly (name, email, phone number, payment details) and information generated through your use of the Service (location data, ride history, device information).</p>

        <h2>2. How We Use Your Information</h2>
        <ul>
          <li>To provide, maintain, and improve the Service</li>
          <li>To process payments and send transaction confirmations</li>
          <li>To match riders with nearby drivers</li>
          <li>To communicate service updates and promotional offers</li>
          <li>To ensure safety and prevent fraud</li>
        </ul>

        <h2>3. Location Data</h2>
        <p>We collect precise location data when the app is in use to enable ride matching, navigation, and fare calculation. You can disable location services in your device settings, but this will limit functionality.</p>

        <h2>4. Data Sharing</h2>
        <p>We share your information with drivers (to fulfil rides), payment processors (to process transactions), and law enforcement (when required by law). We do not sell your personal data to third parties.</p>

        <h2>5. Data Retention</h2>
        <p>We retain your data for as long as your account is active or as needed to provide services, comply with legal obligations, and resolve disputes.</p>

        <h2>6. Security</h2>
        <p>We implement industry-standard security measures to protect your data, including encryption in transit and at rest. However, no method of transmission is 100% secure.</p>

        <h2>7. Your Rights</h2>
        <p>You may request access to, correction of, or deletion of your personal data by contacting us. We will respond within 30 days.</p>

        <h2>8. Cookies</h2>
        <p>We use essential cookies and local storage to maintain your session and preferences. No third-party tracking cookies are used.</p>

        <h2>9. Changes to This Policy</h2>
        <p>We may update this Privacy Policy periodically. We will notify you of material changes via the app or email.</p>

        <h2>10. Contact</h2>
        <p>For privacy-related inquiries, contact us at <a href="tel:+18679888836" className="text-primary">(867) 988-8836</a>.</p>
      </article>
    </div>
  );
};

export default PrivacyPolicy;
