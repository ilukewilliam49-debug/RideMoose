import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Car, FileText, ArrowLeft, Loader2, LogOut, ShieldCheck, User } from "lucide-react";
import { motion } from "framer-motion";
import logoImg from "@/assets/logo.png";
import DocumentUploadCard from "@/components/driver/DocumentUploadCard";
import { DRIVER_DOCUMENTS, REQUIRED_DOC_TYPES } from "@/lib/driver-documents";

const VEHICLE_TYPES = ["Sedan", "SUV", "Van", "Truck"] as const;

const STEPS = [
  { key: "contact", label: "Contact", icon: User },
  { key: "vehicle", label: "Vehicle", icon: Car },
  { key: "documents", label: "Documents", icon: FileText },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

const PHONE_REGEX = /^\+?[1-9]\d{9,14}$/;
const LICENSE_PLATE_REGEX = /^[A-Z0-9]{1,8}[-\s]?[A-Z0-9]{1,8}$/i;

const DriverOnboarding = () => {
  const { user, profile, signOut } = useAuth();
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

  // Latest verification per doc type
  const latestByType = useMemo(() => {
    const acc: Record<string, any> = {};
    (verifications || []).forEach((v: any) => {
      if (!acc[v.document_type]) acc[v.document_type] = v;
    });
    return acc;
  }, [verifications]);

  const docStatus = (type: string): "missing" | "uploading" | "pending" | "approved" | "rejected" => {
    if (uploading === type) return "uploading";
    const v = latestByType[type];
    if (!v) return "missing";
    if (v.status === "approved") return "approved";
    if (v.status === "rejected") return "rejected";
    return "pending";
  };

  // Validation helpers
  const validateContact = (): boolean => {
    const e: Record<string, string> = {};
    if (!fullName.trim() || fullName.trim().length < 2) {
      e.fullName = "Please enter your full legal name.";
    }
    const cleaned = phone.trim().replace(/[\s\-()]/g, "");
    if (!cleaned) e.phone = "Cellphone number is required.";
    else if (!PHONE_REGEX.test(cleaned))
      e.phone = "Enter a valid phone number (e.g. +1 416 555 1234).";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateVehicle = (): boolean => {
    const e: Record<string, string> = {};
    if (!vehicleType) e.vehicleType = "Select a vehicle type.";
    if (!vehicleMake.trim()) e.vehicleMake = "Required.";
    if (!vehicleModel.trim()) e.vehicleModel = "Required.";
    const yearNum = parseInt(vehicleYear);
    if (!vehicleYear || isNaN(yearNum)) e.vehicleYear = "Required.";
    else if (yearNum < 2016 || yearNum > currentYear)
      e.vehicleYear = `Year must be 2016–${currentYear}.`;
    if (!vehicleColor.trim()) e.vehicleColor = "Required.";
    if (!licensePlate.trim()) e.licensePlate = "Required.";
    else if (!LICENSE_PLATE_REGEX.test(licensePlate.trim()))
      e.licensePlate = "Use letters and numbers only (e.g. ABC-1234).";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSaveContact = async () => {
    if (!validateContact()) return;
    setSaving(true);
    try {
      const cleaned = phone.trim().replace(/[\s\-()]/g, "");
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName.trim(), phone: cleaned })
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

      // Short-lived signed URL — store path so admins can re-sign on view
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

      // Notify admins of submission
      const { data: admins } = await supabase
        .from("profiles")
        .select("id")
        .eq("role", "admin");
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

  const allRequiredUploaded = REQUIRED_DOC_TYPES.every((t) => {
    const s = docStatus(t);
    return s === "pending" || s === "approved";
  });

  const handleSubmit = () => {
    toast.success("Application submitted! We'll notify you once approved.");
    navigate("/driver/onboarding/pending", { replace: true });
  };

  const stepIndex = STEPS.findIndex((s) => s.key === step);

  return (
    <div
      className="min-h-screen flex items-start sm:items-center justify-center px-4 py-8 relative overflow-hidden"
      style={{ background: "linear-gradient(180deg, hsl(220 30% 10%), hsl(220 30% 6%))" }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 40%, hsl(213 84% 56% / 0.06) 0%, transparent 70%)",
        }}
      />

      {/* Top-right sign out */}
      <button
        onClick={signOut}
        className="absolute top-4 right-4 z-10 inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
        aria-label="Sign out"
      >
        <LogOut className="h-3.5 w-3.5" />
        Sign out
      </button>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg relative"
      >
        <div className="text-center mb-6">
          <button
            type="button"
            onClick={() => navigate("/?view=landing", { replace: true })}
            aria-label="Go to homepage"
            className="block mx-auto mb-4 rounded-xl transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <img
              src={logoImg}
              alt="PickYou"
              className="h-14 rounded-xl drop-shadow-[0_0_12px_hsl(var(--primary)/0.4)]"
            />
          </button>
          <h1 className="text-xl font-semibold text-foreground">Become a Driver</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Most applications are reviewed within 24 hours.
          </p>

          {/* Stepper */}
          <ol className="mt-5 flex items-center justify-center gap-2">
            {STEPS.map((s, idx) => {
              const active = idx === stepIndex;
              const done = idx < stepIndex;
              const Icon = s.icon;
              return (
                <li key={s.key} className="flex items-center gap-2">
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold transition-colors ${
                      done
                        ? "bg-primary border-primary text-primary-foreground"
                        : active
                          ? "border-primary text-primary bg-primary/10"
                          : "border-border text-muted-foreground"
                    }`}
                  >
                    {done ? <ShieldCheck className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                  </div>
                  <span
                    className={`text-xs ${
                      active ? "text-foreground font-medium" : "text-muted-foreground"
                    }`}
                  >
                    {s.label}
                  </span>
                  {idx < STEPS.length - 1 && (
                    <span
                      className={`hidden sm:inline-block h-px w-6 ${
                        done ? "bg-primary" : "bg-border"
                      }`}
                    />
                  )}
                </li>
              );
            })}
          </ol>
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
          {/* STEP 1: CONTACT */}
          {step === "contact" && (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <User className="h-5 w-5 text-primary" />
                  Your contact info
                </CardTitle>
                <CardDescription>
                  We'll use this to reach you about your application and rides.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="fullName">Full legal name <span className="text-destructive">*</span></Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="As shown on your driver's license"
                    className={`bg-secondary border-border ${errors.fullName ? "border-destructive" : ""}`}
                    autoComplete="name"
                    maxLength={100}
                  />
                  {errors.fullName && (
                    <p className="text-xs text-destructive">{errors.fullName}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Cellphone number <span className="text-destructive">*</span></Label>
                  <Input
                    id="phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="+1 416 555 1234"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={`bg-secondary border-border ${errors.phone ? "border-destructive" : ""}`}
                    maxLength={20}
                  />
                  {errors.phone ? (
                    <p className="text-xs text-destructive">{errors.phone}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Required so riders and dispatch can reach you.
                    </p>
                  )}
                </div>
                <Button className="w-full" onClick={handleSaveContact} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Continue
                </Button>
              </CardContent>
            </>
          )}

          {/* STEP 2: VEHICLE */}
          {step === "vehicle" && (
            <>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Car className="h-5 w-5 text-primary" />
                      Vehicle details
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Tell us about the vehicle you'll be driving.
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setStep("contact")}
                    className="shrink-0"
                  >
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Back
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Type <span className="text-destructive">*</span></Label>
                    <Select value={vehicleType} onValueChange={setVehicleType}>
                      <SelectTrigger className={`bg-secondary border-border ${errors.vehicleType ? "border-destructive" : ""}`}>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {VEHICLE_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.vehicleType && (
                      <p className="text-xs text-destructive">{errors.vehicleType}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Seats</Label>
                    <Select value={seatCapacity} onValueChange={setSeatCapacity}>
                      <SelectTrigger className="bg-secondary border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {n} {n === 1 ? "seat" : "seats"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Make <span className="text-destructive">*</span></Label>
                    <Input
                      placeholder="Toyota"
                      value={vehicleMake}
                      onChange={(e) => setVehicleMake(e.target.value)}
                      className={`bg-secondary border-border ${errors.vehicleMake ? "border-destructive" : ""}`}
                      maxLength={50}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Model <span className="text-destructive">*</span></Label>
                    <Input
                      placeholder="Corolla"
                      value={vehicleModel}
                      onChange={(e) => setVehicleModel(e.target.value)}
                      className={`bg-secondary border-border ${errors.vehicleModel ? "border-destructive" : ""}`}
                      maxLength={50}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label>Year <span className="text-destructive">*</span></Label>
                    <Input
                      placeholder="2020"
                      value={vehicleYear}
                      onChange={(e) =>
                        setVehicleYear(e.target.value.replace(/\D/g, "").slice(0, 4))
                      }
                      className={`bg-secondary border-border ${errors.vehicleYear ? "border-destructive" : ""}`}
                      inputMode="numeric"
                    />
                    {errors.vehicleYear && (
                      <p className="text-[11px] text-destructive">{errors.vehicleYear}</p>
                    )}
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <Label>Color <span className="text-destructive">*</span></Label>
                    <Input
                      placeholder="White"
                      value={vehicleColor}
                      onChange={(e) => setVehicleColor(e.target.value)}
                      className={`bg-secondary border-border ${errors.vehicleColor ? "border-destructive" : ""}`}
                      maxLength={30}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>License plate <span className="text-destructive">*</span></Label>
                  <Input
                    placeholder="ABC-1234"
                    value={licensePlate}
                    onChange={(e) => setLicensePlate(e.target.value)}
                    className={`bg-secondary border-border uppercase ${errors.licensePlate ? "border-destructive" : ""}`}
                    maxLength={15}
                    autoCapitalize="characters"
                  />
                  {errors.licensePlate && (
                    <p className="text-xs text-destructive">{errors.licensePlate}</p>
                  )}
                </div>
                <Button className="w-full" onClick={handleSaveVehicle} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Continue
                </Button>
              </CardContent>
            </>
          )}

          {/* STEP 3: DOCUMENTS */}
          {step === "documents" && (
            <>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <FileText className="h-5 w-5 text-primary" />
                      Upload your documents
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Photos or PDFs. Max 10 MB each.
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setStep("vehicle")}
                    className="shrink-0"
                  >
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Back
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
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

                <Button
                  className="w-full mt-2"
                  onClick={handleSubmit}
                  disabled={!allRequiredUploaded}
                >
                  {allRequiredUploaded
                    ? "Submit for Review"
                    : `Upload ${REQUIRED_DOC_TYPES.length} required documents to continue`}
                </Button>
              </CardContent>
            </>
          )}
        </Card>
      </motion.div>
    </div>
  );
};

export default DriverOnboarding;
