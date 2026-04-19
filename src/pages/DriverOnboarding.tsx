import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Car,
  ArrowLeft,
  Loader2,
  LogOut,
  ShieldCheck,
  Check,
  Truck,
  Bus,
  CarFront,
  User,
} from "lucide-react";
import { useActiveRole } from "@/contexts/ActiveRoleContext";
import { motion, AnimatePresence } from "framer-motion";
import logoImg from "@/assets/logo.png";
import DocumentUploadCard from "@/components/driver/DocumentUploadCard";
import { OnboardingProgress } from "@/components/driver/OnboardingProgress";
import { SubmittedSuccess } from "@/components/driver/SubmittedSuccess";
import { DRIVER_DOCUMENTS, REQUIRED_DOC_TYPES } from "@/lib/driver-documents";

const VEHICLE_TYPES = [
  { value: "Sedan", icon: CarFront },
  { value: "SUV", icon: Car },
  { value: "Van", icon: Bus },
  { value: "Truck", icon: Truck },
] as const;

const COLOR_OPTIONS = [
  "Black",
  "White",
  "Silver",
  "Grey",
  "Blue",
  "Red",
  "Other",
] as const;

const SEAT_OPTIONS = ["4", "5", "6", "7"] as const;

const STEPS = [
  { key: "contact", label: "About you" },
  { key: "vehicle", label: "Vehicle" },
  { key: "documents", label: "Documents" },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

const PHONE_REGEX = /^\+?[1-9]\d{9,14}$/;
const LICENSE_PLATE_REGEX = /^[A-Z0-9]{1,8}[-\s]?[A-Z0-9]{1,8}$/i;

const DriverOnboarding = () => {
  const { user, profile, signOut } = useAuth();
  const { setActiveRole } = useActiveRole();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<StepKey>(
    profile?.vehicle_type ? "documents" : profile?.phone ? "vehicle" : "contact",
  );

  // Contact
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [phone, setPhone] = useState(profile?.phone || "");

  // Vehicle
  const [vehicleType, setVehicleType] = useState(profile?.vehicle_type || "");
  const [seatCapacity, setSeatCapacity] = useState(String(profile?.seat_capacity || 4));
  const [vehicleMake, setVehicleMake] = useState(profile?.vehicle_make || "");
  const [vehicleModel, setVehicleModel] = useState(profile?.vehicle_model || "");
  const [vehicleYear, setVehicleYear] = useState(
    profile?.vehicle_year ? String(profile.vehicle_year) : "",
  );
  const [vehicleColor, setVehicleColor] = useState(profile?.vehicle_color || "");
  const [licensePlate, setLicensePlate] = useState(profile?.license_plate || "");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const currentYear = new Date().getFullYear();

  // Sync from profile when it loads
  useEffect(() => {
    if (!profile) return;
    if (profile.full_name && !fullName) setFullName(profile.full_name);
    if (profile.phone && !phone) setPhone(profile.phone);
    if (profile.vehicle_type && !vehicleType) setVehicleType(profile.vehicle_type);
    if (profile.vehicle_make && !vehicleMake) setVehicleMake(profile.vehicle_make);
    if (profile.vehicle_model && !vehicleModel) setVehicleModel(profile.vehicle_model);
    if (profile.vehicle_year && !vehicleYear) setVehicleYear(String(profile.vehicle_year));
    if (profile.vehicle_color && !vehicleColor) setVehicleColor(profile.vehicle_color);
    if (profile.license_plate && !licensePlate) setLicensePlate(profile.license_plate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  // Persist uploaded docs from DB
  const { data: verifications } = useQuery({
    queryKey: ["driver-verifications", profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("verifications")
        .select("document_type, document_url, status, reviewer_notes")
        .eq("driver_id", profile!.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!profile?.id,
    refetchInterval: 15_000,
  });

  // Guard: if user is not a driver, send them home.
  // If driver has already completed onboarding (vehicle + all required docs uploaded),
  // forward to the pending page (which itself forwards to /driver when fully approved).
  // This prevents users from being "stuck" on the onboarding form after completion.
  useEffect(() => {
    if (!profile) return;
    if (!profile.is_driver) {
      navigate("/rider", { replace: true });
      return;
    }
    if (verifications === undefined) return; // wait for fetch
    const hasVehicle = !!profile.vehicle_type;
    const hasAllDocs = REQUIRED_DOC_TYPES.every((docType) =>
      (verifications || []).some((v: any) => v.document_type === docType),
    );
    if (hasVehicle && hasAllDocs && !submitted) {
      navigate("/driver/onboarding/pending", { replace: true });
    }
  }, [profile, verifications, navigate, submitted]);

  // Latest verification per doc type
  const latestByType = useMemo(() => {
    const acc: Record<string, any> = {};
    (verifications || []).forEach((v: any) => {
      if (!acc[v.document_type]) acc[v.document_type] = v;
    });
    return acc;
  }, [verifications]);

  const docStatus = (
    type: string,
  ): "missing" | "uploading" | "pending" | "approved" | "rejected" => {
    if (uploading === type) return "uploading";
    const v = latestByType[type];
    if (!v) return "missing";
    if (v.status === "approved") return "approved";
    if (v.status === "rejected") return "rejected";
    return "pending";
  };

  // Per-field validity (drives green-check + button enable state)
  const cleanedPhone = phone.trim().replace(/[\s\-()]/g, "");
  const isFullNameValid = fullName.trim().length >= 2;
  const isPhoneValid = PHONE_REGEX.test(cleanedPhone);
  const contactValid = isFullNameValid && isPhoneValid;

  const yearNum = parseInt(vehicleYear);
  const isYearValid = !isNaN(yearNum) && yearNum >= 2016 && yearNum <= currentYear;
  const isPlateValid = LICENSE_PLATE_REGEX.test(licensePlate.trim());
  const vehicleValid =
    !!vehicleType &&
    vehicleMake.trim().length > 0 &&
    vehicleModel.trim().length > 0 &&
    isYearValid &&
    !!vehicleColor.trim() &&
    isPlateValid;

  const validateContact = (): boolean => {
    const e: Record<string, string> = {};
    if (!isFullNameValid) e.fullName = "Please enter your full legal name.";
    if (!cleanedPhone) e.phone = "Cellphone number is required.";
    else if (!isPhoneValid) e.phone = "Enter a valid phone number (e.g. +1 416 555 1234).";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateVehicle = (): boolean => {
    const e: Record<string, string> = {};
    if (!vehicleType) e.vehicleType = "Select a vehicle type.";
    if (!vehicleMake.trim()) e.vehicleMake = "Required.";
    if (!vehicleModel.trim()) e.vehicleModel = "Required.";
    if (!vehicleYear || isNaN(yearNum)) e.vehicleYear = "Required.";
    else if (!isYearValid) e.vehicleYear = `Year must be 2016–${currentYear}.`;
    if (!vehicleColor.trim()) e.vehicleColor = "Required.";
    if (!licensePlate.trim()) e.licensePlate = "Required.";
    else if (!isPlateValid) e.licensePlate = "Use letters and numbers only (e.g. ABC-1234).";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSaveContact = async () => {
    if (!validateContact()) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName.trim(), phone: cleanedPhone })
        .eq("user_id", user!.id);
      if (error) throw error;
      setStep("vehicle");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveVehicle = async () => {
    if (!validateVehicle()) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          vehicle_type: vehicleType,
          seat_capacity: parseInt(seatCapacity),
          vehicle_make: vehicleMake.trim(),
          vehicle_model: vehicleModel.trim(),
          vehicle_year: parseInt(vehicleYear),
          vehicle_color: vehicleColor.trim(),
          license_plate: licensePlate.trim().toUpperCase(),
        })
        .eq("user_id", user!.id);
      if (error) throw error;
      setStep("documents");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUploadDocument = async (docType: string, file: File) => {
    if (!profile) return;
    setUploading(docType);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const filePath = `${profile.id}/${docType}_${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("proof-photos")
        .upload(filePath, file, { upsert: false, contentType: file.type });
      if (uploadError) throw uploadError;

      const { data: signedData, error: signedError } = await supabase.storage
        .from("proof-photos")
        .createSignedUrl(filePath, 60 * 60 * 24 * 7);
      if (signedError) throw signedError;

      const { error: insertError } = await supabase.from("verifications").insert({
        driver_id: profile.id,
        document_type: docType,
        document_url: signedData.signedUrl,
        status: "pending",
      });
      if (insertError) throw insertError;

      const { data: adminRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");
      const { data: admins } = adminRoles && adminRoles.length > 0
        ? await supabase
            .from("profiles")
            .select("id")
            .in("user_id", adminRoles.map((r: any) => r.user_id))
        : { data: [] as Array<{ id: string }> };
      if (admins && admins.length > 0) {
        await supabase.from("notifications").insert(
          admins.map((a: any) => ({
            user_id: a.id,
            title: "New Driver Document",
            body: `${profile.full_name || "A driver"} uploaded ${
              DRIVER_DOCUMENTS.find((d) => d.type === docType)?.label || docType
            }.`,
            type: "verification_submitted",
          })),
        );
      }

      await queryClient.invalidateQueries({
        queryKey: ["driver-verifications", profile.id],
      });
      toast.success("Document uploaded — we'll review shortly.");
    } catch (err: any) {
      toast.error(err.message || "Upload failed. Please try again.");
    } finally {
      setUploading(null);
    }
  };

  const uploadedRequiredCount = REQUIRED_DOC_TYPES.filter((t) => {
    const s = docStatus(t);
    return s === "pending" || s === "approved";
  }).length;
  const allRequiredUploaded = uploadedRequiredCount === REQUIRED_DOC_TYPES.length;
  const docProgress = (uploadedRequiredCount / REQUIRED_DOC_TYPES.length) * 100;

  const handleSubmit = () => {
    setSubmitted(true);
    setTimeout(() => {
      navigate("/driver/onboarding/pending", { replace: true });
    }, 2000);
  };

  const stepIndex = STEPS.findIndex((s) => s.key === step);

  // Allow tapping a completed step to go back
  const handleStepClick = (idx: number) => {
    if (idx < stepIndex) {
      setStep(STEPS[idx].key);
      setErrors({});
    }
  };

  if (submitted) {
    return <SubmittedSuccess />;
  }

  return (
    <div
      className="min-h-screen flex items-start sm:items-center justify-center px-4 pt-8 pb-32 sm:pb-8 relative overflow-hidden"
      style={{ background: "linear-gradient(180deg, hsl(220 30% 10%), hsl(220 30% 6%))" }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 40%, hsl(213 84% 56% / 0.06) 0%, transparent 70%)",
        }}
      />

      {/* Top-right actions */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5">
        <button
          onClick={() => {
            setActiveRole("rider");
            navigate("/rider");
          }}
          className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
          aria-label="Use rider mode"
        >
          <User className="h-3.5 w-3.5" />
          Use rider mode
        </button>
        <button
          onClick={signOut}
          className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
          aria-label="Sign out"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg relative"
      >
        <div className="text-center mb-5">
          <button
            type="button"
            onClick={() => navigate("/")}
            aria-label="Go to homepage"
            className="block mx-auto mb-3 rounded-xl transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <img
              src={logoImg}
              alt="PickYou"
              className="h-12 rounded-xl drop-shadow-[0_0_12px_hsl(var(--primary)/0.4)]"
            />
          </button>
        </div>

        {/* Labelled progress bar */}
        <div className="mb-4 px-1">
          <OnboardingProgress
            steps={STEPS as unknown as { key: string; label: string }[]}
            currentIndex={stepIndex}
            onStepClick={handleStepClick}
          />
        </div>

        <Card
          className="border-border/50 backdrop-blur-xl"
          style={{
            background:
              "linear-gradient(135deg, hsl(222 35% 10% / 0.8), hsl(222 40% 7% / 0.9))",
            boxShadow:
              "0 0 40px -10px hsl(213 84% 56% / 0.12), 0 4px 24px -4px hsl(0 0% 0% / 0.4), inset 0 1px 0 0 hsl(0 0% 100% / 0.05)",
          }}
        >
          <AnimatePresence mode="wait">
            {/* STEP 1: CONTACT */}
            {step === "contact" && (
              <motion.div
                key="contact"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.2 }}
              >
                <CardContent className="pt-6 space-y-4">
                  <div className="space-y-1">
                    <h2 className="text-xl font-bold text-foreground">Let's start with you</h2>
                    <p className="text-sm text-muted-foreground">
                      We'll text you when riders need you.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="fullName">Full legal name</Label>
                    <div className="relative">
                      <Input
                        id="fullName"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="As shown on your driver's license"
                        className={`bg-secondary border-border pr-10 ${
                          errors.fullName ? "border-destructive" : ""
                        }`}
                        autoComplete="name"
                        maxLength={100}
                      />
                      {isFullNameValid && (
                        <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
                      )}
                    </div>
                    {errors.fullName && (
                      <p className="text-xs text-destructive">{errors.fullName}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="phone">Mobile number</Label>
                    <div className="relative">
                      <Input
                        id="phone"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="+1 867 555 1234"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className={`bg-secondary border-border pr-10 ${
                          errors.phone ? "border-destructive" : ""
                        }`}
                        maxLength={20}
                      />
                      {isPhoneValid && (
                        <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
                      )}
                    </div>
                    {errors.phone ? (
                      <p className="text-xs text-destructive">{errors.phone}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        We'll send a verification code next.
                      </p>
                    )}
                  </div>
                </CardContent>
              </motion.div>
            )}

            {/* STEP 2: VEHICLE */}
            {step === "vehicle" && (
              <motion.div
                key="vehicle"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.2 }}
              >
                <CardContent className="pt-6 space-y-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <h2 className="text-xl font-bold text-foreground">
                        Tell us about your ride
                      </h2>
                      <p className="text-sm text-muted-foreground">Must be 2016 or newer.</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setStep("contact")}
                      className="shrink-0 -mr-2"
                    >
                      <ArrowLeft className="h-4 w-4 mr-1" />
                      Back
                    </Button>
                  </div>

                  {/* Vehicle type — chip selector */}
                  <div className="space-y-2">
                    <Label>Vehicle type</Label>
                    <div className="grid grid-cols-4 gap-2">
                      {VEHICLE_TYPES.map((type) => {
                        const Icon = type.icon;
                        const selected = vehicleType === type.value;
                        return (
                          <button
                            key={type.value}
                            type="button"
                            onClick={() => setVehicleType(type.value)}
                            className={`flex flex-col items-center gap-1.5 rounded-xl border-2 px-2 py-3 text-xs font-medium transition-all active:scale-95 ${
                              selected
                                ? "border-primary bg-primary/10 text-foreground"
                                : "border-border bg-secondary/40 text-muted-foreground hover:border-border/80"
                            }`}
                          >
                            <Icon className="h-5 w-5" />
                            {type.value}
                          </button>
                        );
                      })}
                    </div>
                    {errors.vehicleType && (
                      <p className="text-xs text-destructive">{errors.vehicleType}</p>
                    )}
                  </div>

                  {/* Year */}
                  <div className="space-y-1.5">
                    <Label>Year</Label>
                    <div className="relative">
                      <Input
                        placeholder="2020"
                        value={vehicleYear}
                        onChange={(e) =>
                          setVehicleYear(e.target.value.replace(/\D/g, "").slice(0, 4))
                        }
                        className={`bg-secondary border-border pr-10 ${
                          errors.vehicleYear ? "border-destructive" : ""
                        }`}
                        inputMode="numeric"
                      />
                      {isYearValid && (
                        <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
                      )}
                    </div>
                    {errors.vehicleYear && (
                      <p className="text-xs text-destructive">{errors.vehicleYear}</p>
                    )}
                  </div>

                  {/* Make + Model */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Make</Label>
                      <Input
                        placeholder="Toyota"
                        value={vehicleMake}
                        onChange={(e) => setVehicleMake(e.target.value)}
                        className={`bg-secondary border-border ${
                          errors.vehicleMake ? "border-destructive" : ""
                        }`}
                        maxLength={50}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Model</Label>
                      <Input
                        placeholder="Corolla"
                        value={vehicleModel}
                        onChange={(e) => setVehicleModel(e.target.value)}
                        className={`bg-secondary border-border ${
                          errors.vehicleModel ? "border-destructive" : ""
                        }`}
                        maxLength={50}
                      />
                    </div>
                  </div>

                  {/* Color chips */}
                  <div className="space-y-2">
                    <Label>Color</Label>
                    <div className="flex flex-wrap gap-2">
                      {COLOR_OPTIONS.map((c) => {
                        const selected = vehicleColor === c;
                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setVehicleColor(c)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-all active:scale-95 ${
                              selected
                                ? "border-primary bg-primary/10 text-foreground"
                                : "border-border bg-secondary/40 text-muted-foreground"
                            }`}
                          >
                            {c}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Plate */}
                  <div className="space-y-1.5">
                    <Label>License plate</Label>
                    <div className="relative">
                      <Input
                        placeholder="ABC-1234"
                        value={licensePlate}
                        onChange={(e) => setLicensePlate(e.target.value.toUpperCase())}
                        className={`bg-secondary border-border uppercase pr-10 ${
                          errors.licensePlate ? "border-destructive" : ""
                        }`}
                        maxLength={15}
                        autoCapitalize="characters"
                      />
                      {isPlateValid && (
                        <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
                      )}
                    </div>
                    {errors.licensePlate && (
                      <p className="text-xs text-destructive">{errors.licensePlate}</p>
                    )}
                  </div>

                  {/* Seats chips */}
                  <div className="space-y-2">
                    <Label>Passenger seats</Label>
                    <div className="flex gap-2">
                      {SEAT_OPTIONS.map((n) => {
                        const selected = seatCapacity === n;
                        return (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setSeatCapacity(n)}
                            className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold border-2 transition-all active:scale-95 ${
                              selected
                                ? "border-primary bg-primary/10 text-foreground"
                                : "border-border bg-secondary/40 text-muted-foreground"
                            }`}
                          >
                            {n === "7" ? "7+" : n}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <p className="text-[11px] text-muted-foreground text-center">
                    Vehicle info can be updated later.
                  </p>
                </CardContent>
              </motion.div>
            )}

            {/* STEP 3: DOCUMENTS */}
            {step === "documents" && (
              <motion.div
                key="documents"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.2 }}
              >
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <h2 className="text-xl font-bold text-foreground">Upload 3 documents</h2>
                      <p className="text-sm text-muted-foreground">
                        Snap a photo or pick from your gallery. Takes about 2 minutes.
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setStep("vehicle")}
                      className="shrink-0 -mr-2"
                    >
                      <ArrowLeft className="h-4 w-4 mr-1" />
                      Back
                    </Button>
                  </div>

                  {/* Upload progress */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground">
                        {uploadedRequiredCount} of {REQUIRED_DOC_TYPES.length} uploaded
                      </span>
                      <span className="text-muted-foreground">
                        {Math.round(docProgress)}%
                      </span>
                    </div>
                    <Progress value={docProgress} className="h-1.5" />
                  </div>

                  <div className="rounded-md border border-primary/20 bg-primary/5 p-2.5 text-xs text-muted-foreground flex items-start gap-2">
                    <ShieldCheck className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                    <span>
                      Your documents are encrypted and only viewed by the PickYou
                      verification team in Yellowknife.
                    </span>
                  </div>

                  {DRIVER_DOCUMENTS.map((doc) => (
                    <DocumentUploadCard
                      key={doc.type}
                      doc={doc}
                      status={docStatus(doc.type)}
                      previewUrl={latestByType[doc.type]?.document_url}
                      reviewerNotes={latestByType[doc.type]?.reviewer_notes}
                      onUpload={(file) => handleUploadDocument(doc.type, file)}
                      disabled={uploading !== null && uploading !== doc.type}
                    />
                  ))}
                </CardContent>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </motion.div>

      {/* Sticky bottom CTA bar (mobile-first) */}
      <div
        className="fixed bottom-0 left-0 right-0 z-20 border-t border-border/50 px-4 py-3 sm:static sm:border-0 sm:px-0 sm:py-0 sm:mt-4 sm:max-w-lg sm:mx-auto sm:bg-transparent"
        style={{
          background:
            "linear-gradient(180deg, hsl(220 30% 8% / 0.8), hsl(220 30% 6%))",
          paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
        }}
      >
        <div className="max-w-lg mx-auto">
          {step === "contact" && (
            <Button
              className="w-full h-12 rounded-xl font-semibold"
              onClick={handleSaveContact}
              disabled={saving || !contactValid}
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Continue
            </Button>
          )}
          {step === "vehicle" && (
            <Button
              className="w-full h-12 rounded-xl font-semibold"
              onClick={handleSaveVehicle}
              disabled={saving || !vehicleValid}
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Continue
            </Button>
          )}
          {step === "documents" && (
            <Button
              className="w-full h-12 rounded-xl font-semibold"
              onClick={handleSubmit}
              disabled={!allRequiredUploaded}
            >
              {allRequiredUploaded
                ? "Submit application →"
                : `Upload ${REQUIRED_DOC_TYPES.length - uploadedRequiredCount} more to continue`}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default DriverOnboarding;
