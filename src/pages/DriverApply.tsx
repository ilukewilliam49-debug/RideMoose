import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, CheckCircle2, AlertTriangle, Upload, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import LandingNav from "@/components/landing/LandingNav";
import LandingFooter from "@/components/landing/LandingFooter";

const CURRENT_YEAR = new Date().getFullYear();
const MIN_VEHICLE_YEAR = CURRENT_YEAR - 15;

const phoneRegex = /^[+]?[\d\s\-().]{7,20}$/;

const stepOneSchema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name").max(120),
  email: z.string().trim().email("Enter a valid email").max(255),
  phone: z.string().trim().regex(phoneRegex, "Enter a valid phone number"),
});

const stepTwoSchema = z.object({
  tier: z.enum(["taxi", "pickyou"], { required_error: "Choose a tier" }),
  vehicle_make: z.string().trim().min(2, "Required").max(40),
  vehicle_model: z.string().trim().min(1, "Required").max(40),
  vehicle_year: z
    .number({ invalid_type_error: "Enter a year" })
    .int()
    .min(MIN_VEHICLE_YEAR, `Vehicle must be ${MIN_VEHICLE_YEAR} or newer`)
    .max(CURRENT_YEAR + 1, "Invalid year"),
});

type FormState = {
  full_name: string;
  email: string;
  phone: string;
  tier: "taxi" | "pickyou" | "";
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: string;
  drivers_license: File | null;
  vehicle_registration: File | null;
  proof_of_insurance: File | null;
  chauffeurs_permit: File | null;
};

const INITIAL: FormState = {
  full_name: "",
  email: "",
  phone: "",
  tier: "",
  vehicle_make: "",
  vehicle_model: "",
  vehicle_year: "",
  drivers_license: null,
  vehicle_registration: null,
  proof_of_insurance: null,
  chauffeurs_permit: null,
};

const STEPS = ["Contact", "Vehicle & Tier", "Documents", "Review"] as const;

const DRAFT_KEY = "pickyou.driver_apply_draft.v1";
const DRAFT_VERSION = 1;

type DraftPayload = {
  v: number;
  step: number;
  form: Omit<FormState, "drivers_license" | "vehicle_registration" | "proof_of_insurance" | "chauffeurs_permit">;
  fileNames: {
    drivers_license: string | null;
    vehicle_registration: string | null;
    proof_of_insurance: string | null;
    chauffeurs_permit: string | null;
  };
  saved_at: string;
};

const serializeDraft = (form: FormState, step: number): DraftPayload => ({
  v: DRAFT_VERSION,
  step,
  form: {
    full_name: form.full_name,
    email: form.email,
    phone: form.phone,
    tier: form.tier,
    vehicle_make: form.vehicle_make,
    vehicle_model: form.vehicle_model,
    vehicle_year: form.vehicle_year,
  },
  fileNames: {
    drivers_license: form.drivers_license?.name ?? null,
    vehicle_registration: form.vehicle_registration?.name ?? null,
    proof_of_insurance: form.proof_of_insurance?.name ?? null,
    chauffeurs_permit: form.chauffeurs_permit?.name ?? null,
  },
  saved_at: new Date().toISOString(),
});

const loadDraft = (): DraftPayload | null => {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftPayload;
    if (parsed?.v !== DRAFT_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
};

const isFormEmpty = (f: FormState) =>
  !f.full_name && !f.email && !f.phone && !f.tier &&
  !f.vehicle_make && !f.vehicle_model && !f.vehicle_year &&
  !f.drivers_license && !f.vehicle_registration && !f.proof_of_insurance && !f.chauffeurs_permit;

const FieldError = ({ id, message }: { id: string; message?: string }) =>
  message ? (
    <p id={`${id}-error`} role="alert" className="mt-1 flex items-center gap-1 text-xs text-destructive">
      <AlertTriangle className="h-3 w-3" /> {message}
    </p>
  ) : null;

type FileFieldProps = {
  id: keyof FormState;
  label: string;
  helper?: string;
  optional?: boolean;
  file: File | null;
  onChange: (f: File | null) => void;
  error?: string;
};

const FileField = ({ id, label, helper, optional, file, onChange, error }: FileFieldProps) => (
  <div className="rounded-xl border border-border/60 bg-card/40 p-4">
    <div className="flex items-start justify-between gap-3">
      <div>
        <Label htmlFor={String(id)} className="text-sm font-semibold">
          {label} {optional && <span className="text-xs text-muted-foreground">(optional)</span>}
        </Label>
        {helper && <p className="mt-0.5 text-xs text-muted-foreground">{helper}</p>}
      </div>
      {file && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
    </div>
    <label
      htmlFor={String(id)}
      className="mt-3 flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border/70 bg-background/40 px-3 py-2.5 text-sm hover:border-primary/40"
    >
      <Upload className="h-4 w-4 text-muted-foreground" />
      <span className="truncate">{file ? file.name : "Choose file (PDF or image)"}</span>
    </label>
    <input
      id={String(id)}
      type="file"
      accept="image/*,.pdf"
      className="hidden"
      onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      aria-invalid={!!error}
    />
    <FieldError id={String(id)} message={error} />
  </div>
);

const DriverApply = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(INITIAL);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [missingFiles, setMissingFiles] = useState<string[]>([]);
  const restoredRef = useRef(false);

  useEffect(() => {
    const prev = document.title;
    document.title = "Apply to Drive — PickYou Yellowknife";
    return () => {
      document.title = prev;
    };
  }, []);

  // Restore draft on mount
  useEffect(() => {
    const draft = loadDraft();
    if (!draft) {
      restoredRef.current = true;
      return;
    }
    setForm((f) => ({ ...f, ...draft.form }));
    setStep(Math.min(Math.max(draft.step, 0), STEPS.length - 1));
    setDraftSavedAt(draft.saved_at);
    const missing = Object.entries(draft.fileNames)
      .filter(([, name]) => !!name)
      .map(([k]) => k);
    setMissingFiles(missing);
    restoredRef.current = true;
    const when = new Date(draft.saved_at).toLocaleString();
    toast.success(`Draft restored from ${when}`, {
      description: missing.length
        ? "Please re-attach your uploaded files — they aren't saved across sessions."
        : "Pick up where you left off.",
    });
  }, []);

  // Auto-save draft on changes (debounced)
  useEffect(() => {
    if (!restoredRef.current || submitted) return;
    if (isFormEmpty(form) && step === 0) return;
    const handle = setTimeout(() => {
      try {
        const payload = serializeDraft(form, step);
        localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
        setDraftSavedAt(payload.saved_at);
      } catch {
        // localStorage may be unavailable (private mode / quota); silently ignore.
      }
    }, 600);
    return () => clearTimeout(handle);
  }, [form, step, submitted]);

  const clearDraft = () => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* noop */
    }
    setForm(INITIAL);
    setErrors({});
    setStep(0);
    setDraftSavedAt(null);
    setMissingFiles([]);
  };

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => {
      if (!e[key as string]) return e;
      const next = { ...e };
      delete next[key as string];
      return next;
    });
  };

  const validateStep = (idx: number): boolean => {
    const next: Record<string, string> = {};
    if (idx === 0) {
      const r = stepOneSchema.safeParse({
        full_name: form.full_name,
        email: form.email,
        phone: form.phone,
      });
      if (!r.success) {
        for (const issue of r.error.issues) next[String(issue.path[0])] = issue.message;
      }
    } else if (idx === 1) {
      const yearNum = form.vehicle_year ? Number(form.vehicle_year) : NaN;
      const r = stepTwoSchema.safeParse({
        tier: form.tier || undefined,
        vehicle_make: form.vehicle_make,
        vehicle_model: form.vehicle_model,
        vehicle_year: yearNum,
      });
      if (!r.success) {
        for (const issue of r.error.issues) next[String(issue.path[0])] = issue.message;
      }
    } else if (idx === 2) {
      if (!form.drivers_license) next.drivers_license = "Driver's license is required";
      if (!form.vehicle_registration) next.vehicle_registration = "Vehicle registration is required";
      if (!form.proof_of_insurance) next.proof_of_insurance = "Proof of insurance is required";
      if (form.tier === "taxi" && !form.chauffeurs_permit) {
        next.chauffeurs_permit = "Chauffeur's permit is required for Taxi tier";
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const next = () => {
    if (!validateStep(step)) {
      toast.error("Please correct the highlighted fields");
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const handleSubmit = async () => {
    if (!validateStep(0) || !validateStep(1) || !validateStep(2)) {
      toast.error("Please complete all required fields");
      return;
    }
    setSubmitting(true);
    try {
      // Stash a lightweight summary so the post-signup onboarding can prefill.
      const summary = {
        full_name: form.full_name,
        email: form.email,
        phone: form.phone,
        tier: form.tier,
        vehicle: {
          make: form.vehicle_make,
          model: form.vehicle_model,
          year: Number(form.vehicle_year),
        },
        submitted_at: new Date().toISOString(),
      };
      sessionStorage.setItem("pickyou.driver_apply_draft", JSON.stringify(summary));
      setSubmitted(true);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const yearHint = useMemo(
    () => `Must be ${MIN_VEHICLE_YEAR} or newer (15-year limit)`,
    [],
  );

  if (submitted) {
    return (
      <div className="min-h-screen bg-background">
        <LandingNav />
        <main className="mx-auto max-w-2xl px-5 py-20 text-center">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-primary/15">
            <CheckCircle2 className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-3xl font-black tracking-tight">Application received</h1>
          <p className="mt-3 text-muted-foreground">
            Thanks, {form.full_name.split(" ")[0]}. We'll review your application and get
            back to you within 24 hours at <span className="text-foreground">{form.email}</span>.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button onClick={() => navigate("/")} variant="outline">Back to home</Button>
            <Button onClick={() => navigate("/login?role=driver")}>
              Create account <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </div>
        </main>
        <LandingFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <LandingNav />
      <main className="mx-auto max-w-2xl px-5 py-10 md:py-16">
        <button
          type="button"
          onClick={() => navigate("/drive")}
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Drive
        </button>

        <h1 className="text-3xl md:text-4xl font-black tracking-tight">Apply to drive with PickYou</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Takes about 4 minutes. We'll review and respond within 24 hours.
        </p>

        {/* Step indicator */}
        <div className="mt-8 flex items-center gap-2">
          {STEPS.map((label, i) => (
            <div key={label} className="flex flex-1 items-center gap-2">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                  i < step
                    ? "bg-primary text-primary-foreground"
                    : i === step
                      ? "bg-primary/15 text-primary ring-2 ring-primary"
                      : "bg-secondary text-muted-foreground"
                }`}
              >
                {i < step ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-0.5 flex-1 rounded-full ${i < step ? "bg-primary" : "bg-border"}`} />
              )}
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Step {step + 1} of {STEPS.length} · <span className="text-foreground font-medium">{STEPS[step]}</span>
        </p>

        <div className="mt-8 rounded-2xl bg-card/60 ring-1 ring-border/40 p-5 md:p-7">
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="full_name">Full name</Label>
                <Input
                  id="full_name"
                  value={form.full_name}
                  onChange={(e) => update("full_name", e.target.value)}
                  aria-invalid={!!errors.full_name}
                  placeholder="Jane Doe"
                />
                <FieldError id="full_name" message={errors.full_name} />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  aria-invalid={!!errors.email}
                  placeholder="you@example.com"
                />
                <FieldError id="email" message={errors.email} />
              </div>
              <div>
                <Label htmlFor="phone">Phone number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => update("phone", e.target.value)}
                  aria-invalid={!!errors.phone}
                  placeholder="(867) 555-0199"
                />
                <FieldError id="phone" message={errors.phone} />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <div>
                <Label className="text-sm font-semibold">Which tier are you applying for?</Label>
                <RadioGroup
                  value={form.tier || undefined}
                  onValueChange={(v) => update("tier", v as "taxi" | "pickyou")}
                  className="mt-3 grid gap-2"
                >
                  <label
                    htmlFor="tier-taxi"
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                      form.tier === "taxi" ? "border-primary bg-primary/5" : "border-border/60"
                    }`}
                  >
                    <RadioGroupItem id="tier-taxi" value="taxi" className="mt-0.5" />
                    <div>
                      <p className="text-sm font-bold">Taxi</p>
                      <p className="text-xs text-muted-foreground">
                        Traditional metered taxi. Requires a City of Yellowknife Chauffeur's Permit.
                      </p>
                    </div>
                  </label>
                  <label
                    htmlFor="tier-pickyou"
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                      form.tier === "pickyou" ? "border-primary bg-primary/5" : "border-border/60"
                    }`}
                  >
                    <RadioGroupItem id="tier-pickyou" value="pickyou" className="mt-0.5" />
                    <div>
                      <p className="text-sm font-bold">PickYou</p>
                      <p className="text-xs text-muted-foreground">
                        Independent contractor tier. No chauffeur's permit required.
                      </p>
                    </div>
                  </label>
                </RadioGroup>
                <FieldError id="tier" message={errors.tier} />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="sm:col-span-1">
                  <Label htmlFor="vehicle_make">Make</Label>
                  <Input
                    id="vehicle_make"
                    value={form.vehicle_make}
                    onChange={(e) => update("vehicle_make", e.target.value)}
                    aria-invalid={!!errors.vehicle_make}
                    placeholder="Toyota"
                  />
                  <FieldError id="vehicle_make" message={errors.vehicle_make} />
                </div>
                <div className="sm:col-span-1">
                  <Label htmlFor="vehicle_model">Model</Label>
                  <Input
                    id="vehicle_model"
                    value={form.vehicle_model}
                    onChange={(e) => update("vehicle_model", e.target.value)}
                    aria-invalid={!!errors.vehicle_model}
                    placeholder="Camry"
                  />
                  <FieldError id="vehicle_model" message={errors.vehicle_model} />
                </div>
                <div className="sm:col-span-1">
                  <Label htmlFor="vehicle_year">Year</Label>
                  <Input
                    id="vehicle_year"
                    type="number"
                    inputMode="numeric"
                    value={form.vehicle_year}
                    onChange={(e) => update("vehicle_year", e.target.value)}
                    aria-invalid={!!errors.vehicle_year}
                    placeholder={String(CURRENT_YEAR)}
                  />
                  <FieldError id="vehicle_year" message={errors.vehicle_year} />
                  <p className="mt-1 text-[11px] text-muted-foreground">{yearHint}</p>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <FileField
                id="drivers_license"
                label="Driver's License"
                helper="Front of valid government-issued license."
                file={form.drivers_license}
                onChange={(f) => update("drivers_license", f)}
                error={errors.drivers_license}
              />
              <FileField
                id="vehicle_registration"
                label="Vehicle Registration"
                helper="Current registration with plate and VIN visible."
                file={form.vehicle_registration}
                onChange={(f) => update("vehicle_registration", f)}
                error={errors.vehicle_registration}
              />
              <FileField
                id="proof_of_insurance"
                label="Proof of Insurance"
                helper="Valid insurance certificate (pink slip)."
                file={form.proof_of_insurance}
                onChange={(f) => update("proof_of_insurance", f)}
                error={errors.proof_of_insurance}
              />
              <FileField
                id="chauffeurs_permit"
                label="Chauffeur's Permit"
                helper={
                  form.tier === "taxi"
                    ? "Required for Taxi tier — issued by the City of Yellowknife."
                    : "Only required for Taxi tier. Skip if applying for PickYou."
                }
                optional={form.tier !== "taxi"}
                file={form.chauffeurs_permit}
                onChange={(f) => update("chauffeurs_permit", f)}
                error={errors.chauffeurs_permit}
              />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 text-sm">
              <h2 className="text-lg font-bold">Review your application</h2>
              <dl className="grid gap-2 rounded-xl bg-background/40 p-4">
                <Row label="Name" value={form.full_name} />
                <Row label="Email" value={form.email} />
                <Row label="Phone" value={form.phone} />
                <Row label="Tier" value={form.tier === "taxi" ? "Taxi" : "PickYou"} />
                <Row
                  label="Vehicle"
                  value={`${form.vehicle_year} ${form.vehicle_make} ${form.vehicle_model}`}
                />
                <Row label="Driver's License" value={form.drivers_license?.name ?? "—"} />
                <Row label="Registration" value={form.vehicle_registration?.name ?? "—"} />
                <Row label="Insurance" value={form.proof_of_insurance?.name ?? "—"} />
                <Row
                  label="Chauffeur's Permit"
                  value={form.chauffeurs_permit?.name ?? (form.tier === "pickyou" ? "Not required" : "—")}
                />
              </dl>
              <p className="text-xs text-muted-foreground">
                By submitting, you confirm the information is accurate. We'll review and email you within 24 hours.
              </p>
            </div>
          )}

          <div className="mt-7 flex items-center justify-between gap-3">
            <Button variant="outline" onClick={back} disabled={step === 0 || submitting}>
              Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={next}>
                Continue <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? "Submitting…" : "Submit application"}
              </Button>
            )}
          </div>
        </div>
      </main>
      <LandingFooter />
    </div>
  );
};

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-start justify-between gap-4 border-b border-border/30 py-1.5 last:border-0">
    <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
    <dd className="text-right text-sm font-medium">{value}</dd>
  </div>
);

export default DriverApply;
