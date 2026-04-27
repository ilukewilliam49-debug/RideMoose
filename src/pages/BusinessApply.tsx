import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { Building2, ArrowLeft, CheckCircle, Clock, XCircle, AlertTriangle, LogIn } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// Validation schema — mirrors required fields and reasonable bounds.
const phoneRegex = /^[+\d][\d\s\-().]{6,}$/;

const applicationSchema = z.object({
  company_name: z.string().trim()
    .min(2, { message: "Company name must be at least 2 characters" })
    .max(120, { message: "Company name must be 120 characters or fewer" }),
  registration_number: z.string().trim()
    .max(60, { message: "Registration number must be 60 characters or fewer" })
    .optional().or(z.literal("")),
  billing_email: z.string().trim()
    .email({ message: "Enter a valid billing email" })
    .max(255, { message: "Email must be 255 characters or fewer" }),
  accounts_payable_email: z.string().trim()
    .max(255, { message: "Email must be 255 characters or fewer" })
    .email({ message: "Enter a valid email" })
    .optional().or(z.literal("")),
  phone: z.string().trim()
    .regex(phoneRegex, { message: "Enter a valid phone number" })
    .max(40, { message: "Phone number is too long" })
    .optional().or(z.literal("")),
  address: z.string().trim()
    .max(255, { message: "Address must be 255 characters or fewer" })
    .optional().or(z.literal("")),
  contact_person_name: z.string().trim()
    .min(2, { message: "Contact name must be at least 2 characters" })
    .max(120, { message: "Contact name must be 120 characters or fewer" }),
  contact_person_email: z.string().trim()
    .email({ message: "Enter a valid contact email" })
    .max(255, { message: "Email must be 255 characters or fewer" }),
  estimated_monthly_spend_cents: z.number({ invalid_type_error: "Enter a number" })
    .int().min(0, { message: "Cannot be negative" })
    .max(10_000_000_00, { message: "Value is too large" }),
  requested_credit_limit_cents: z.number({ invalid_type_error: "Enter a number" })
    .int().min(0, { message: "Cannot be negative" })
    .max(10_000_000_00, { message: "Value is too large" }),
  payment_terms_requested: z.number({ invalid_type_error: "Enter a number" })
    .int().min(7, { message: "Minimum 7 days" })
    .max(90, { message: "Maximum 90 days" }),
});

type FieldErrors = Partial<Record<keyof z.infer<typeof applicationSchema>, string>>;

const BusinessApply = () => {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    company_name: "",
    registration_number: "",
    billing_email: "",
    accounts_payable_email: "",
    phone: "",
    address: "",
    contact_person_name: profile?.full_name || "",
    contact_person_email: "",
    estimated_monthly_spend_cents: 0,
    requested_credit_limit_cents: 500000,
    payment_terms_requested: 30,
  });

  // Check existing application
  const { data: existingApp, isLoading } = useQuery({
    queryKey: ["my-org-application", profile?.user_id],
    queryFn: async () => {
      if (!profile?.user_id) return null;
      const { data, error } = await supabase
        .from("organization_applications")
        .select("*")
        .eq("applicant_user_id", profile.user_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.user_id,
  });

  const set = (key: string, value: any) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    if (!profile?.user_id) return;
    if (!form.company_name || !form.billing_email || !form.contact_person_name || !form.contact_person_email) {
      toast.error("Please fill in all required fields.");
      return;
    }
    setSubmitting(true);
    try {
      const id = crypto.randomUUID();
      const { error } = await supabase.from("organization_applications").insert({
        id,
        applicant_user_id: profile.user_id,
        ...form,
      });
      if (error) throw error;

      // Send email notification to admin
      await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "corporate-application-notification",
          recipientEmail: "contact@pickyou.ca",
          idempotencyKey: `corp-app-${id}`,
          templateData: {
            companyName: form.company_name,
            contactName: form.contact_person_name,
            contactEmail: form.contact_person_email,
            billingEmail: form.billing_email,
            creditLimit: `$${(form.requested_credit_limit_cents / 100).toFixed(2)}`,
            paymentTerms: form.payment_terms_requested,
            estimatedSpend: `$${(form.estimated_monthly_spend_cents / 100).toFixed(2)}`,
            submittedAt: new Date().toLocaleString(),
          },
        },
      });

      toast.success("Application submitted! We'll review it shortly.");
      navigate("/rider");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const statusIcon: Record<string, any> = {
    pending: <Clock className="h-5 w-5 text-yellow-500" />,
    approved: <CheckCircle className="h-5 w-5 text-green-500" />,
    rejected: <XCircle className="h-5 w-5 text-destructive" />,
    needs_info: <AlertTriangle className="h-5 w-5 text-orange-500" />,
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-pulse w-8 h-8 rounded-full bg-primary" />
      </div>
    );
  }

  // Public access — if not signed in, prompt sign-in but keep the form
  // reachable from the marketing site without forcing role-based gating.
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 py-16 bg-background">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md text-center space-y-5 rounded-2xl border border-border/40 bg-card/40 p-8"
        >
          <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Building2 className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold">Apply for a business account</h1>
          <p className="text-sm text-muted-foreground">
            Sign in or create an account to submit your business application. It only takes a minute.
          </p>
          <div className="flex flex-col gap-2 pt-2">
            <Button
              size="lg"
              className="h-12 rounded-xl text-sm font-bold"
              onClick={() =>
                navigate(`/login?returnTo=${encodeURIComponent("/business/apply")}`)
              }
            >
              <LogIn className="h-4 w-4 mr-2" />
              Sign in to continue
            </Button>
            <Button
              variant="ghost"
              className="h-11 rounded-xl text-sm"
              onClick={() => navigate("/business")}
            >
              Back to business overview
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Show existing application status
  if (existingApp) {
    return (
      <div className="space-y-6 pt-4 max-w-lg mx-auto">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/rider")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Business Application</h1>
        </div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-surface rounded-lg p-6 space-y-4">
          <div className="flex items-center gap-3">
            {statusIcon[existingApp.status]}
            <div>
              <h2 className="font-semibold">{existingApp.company_name}</h2>
              <p className="text-sm text-muted-foreground capitalize">Status: {existingApp.status.replace("_", " ")}</p>
            </div>
          </div>

          {existingApp.status === "pending" && (
            <p className="text-sm text-muted-foreground">Your application is being reviewed. We'll notify you once a decision is made.</p>
          )}
          {existingApp.status === "approved" && (
            <p className="text-sm text-green-500">Your organization has been approved! You can now bill rides to your company.</p>
          )}
          {existingApp.status === "rejected" && (
            <div className="space-y-2">
              <p className="text-sm text-destructive">Your application was not approved at this time.</p>
              {existingApp.admin_notes && (
                <p className="text-xs text-muted-foreground bg-secondary p-3 rounded">{existingApp.admin_notes}</p>
              )}
            </div>
          )}
          {existingApp.status === "needs_info" && (
            <div className="space-y-2">
              <p className="text-sm text-orange-500">Additional information is required.</p>
              {existingApp.admin_notes && (
                <p className="text-xs text-muted-foreground bg-secondary p-3 rounded">{existingApp.admin_notes}</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-[10px] text-muted-foreground">Billing Email</p>
              <p className="font-mono text-xs">{existingApp.billing_email}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Requested Credit</p>
              <p className="font-mono text-xs">${(existingApp.requested_credit_limit_cents / 100).toFixed(2)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Payment Terms</p>
              <p className="font-mono text-xs">Net {existingApp.payment_terms_requested}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Submitted</p>
              <p className="font-mono text-xs">{new Date(existingApp.created_at).toLocaleDateString()}</p>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pt-4 max-w-lg mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/rider")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Business Account Application</h1>
          <p className="text-sm text-muted-foreground">Apply to bill rides to your business</p>
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-surface rounded-lg p-6 space-y-4">
        <div className="space-y-1">
          <Label>Company Name *</Label>
          <Input value={form.company_name} onChange={(e) => set("company_name", e.target.value)} placeholder="Acme Corp" />
        </div>
        <div className="space-y-1">
          <Label>Business Registration #</Label>
          <Input value={form.registration_number} onChange={(e) => set("registration_number", e.target.value)} placeholder="Optional" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Billing Email *</Label>
            <Input type="email" value={form.billing_email} onChange={(e) => set("billing_email", e.target.value)} placeholder="billing@company.com" />
          </div>
          <div className="space-y-1">
            <Label>Accounts Payable Email</Label>
            <Input type="email" value={form.accounts_payable_email} onChange={(e) => set("accounts_payable_email", e.target.value)} placeholder="ap@company.com" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Phone</Label>
            <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+1 (867) 555-0100" />
          </div>
          <div className="space-y-1">
            <Label>Address</Label>
            <Input value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="123 Main St, Yellowknife" />
          </div>
        </div>

        <div className="border-t border-border pt-4 space-y-1">
          <Label className="text-xs text-muted-foreground">Primary Contact</Label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Contact Name *</Label>
            <Input value={form.contact_person_name} onChange={(e) => set("contact_person_name", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Contact Email *</Label>
            <Input type="email" value={form.contact_person_email} onChange={(e) => set("contact_person_email", e.target.value)} />
          </div>
        </div>

        <div className="border-t border-border pt-4 space-y-1">
          <Label className="text-xs text-muted-foreground">Financial Details</Label>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label>Est. Monthly Spend ($)</Label>
            <Input type="number" value={form.estimated_monthly_spend_cents / 100} onChange={(e) => set("estimated_monthly_spend_cents", Math.round(parseFloat(e.target.value || "0") * 100))} />
          </div>
          <div className="space-y-1">
            <Label>Credit Limit ($)</Label>
            <Input type="number" value={form.requested_credit_limit_cents / 100} onChange={(e) => set("requested_credit_limit_cents", Math.round(parseFloat(e.target.value || "0") * 100))} />
          </div>
          <div className="space-y-1">
            <Label>Terms (days)</Label>
            <Input type="number" value={form.payment_terms_requested} onChange={(e) => set("payment_terms_requested", parseInt(e.target.value) || 30)} />
          </div>
        </div>

        <Button onClick={handleSubmit} disabled={submitting} className="w-full mt-2">
          <Building2 className="h-4 w-4 mr-2" />
          {submitting ? "Submitting..." : "Submit Application"}
        </Button>
      </motion.div>
    </div>
  );
};

export default BusinessApply;
