import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Car, FileText, Upload, CheckCircle2, Loader2, LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import logoImg from "@/assets/logo.png";

const VEHICLE_TYPES = ["Sedan", "SUV", "Van", "Truck"] as const;

const REQUIRED_DOCUMENTS = [
  { type: "drivers_license", label: "Driver's License", optional: false },
  { type: "chauffeurs_permit", label: "Chauffeur's Permit", optional: true },
  { type: "vehicle_insurance", label: "Vehicle Insurance", optional: false },
  { type: "vehicle_registration", label: "Vehicle Registration", optional: false },
] as const;

const DriverOnboarding = () => {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [step, setStep] = useState(1);
  const [vehicleType, setVehicleType] = useState("");
  const [seatCapacity, setSeatCapacity] = useState("4");
  const [vehicleMake, setVehicleMake] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleYear, setVehicleYear] = useState("");
  const [vehicleColor, setVehicleColor] = useState("");
  const [licensePlate, setLicensePlate] = useState("");
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadedDocs, setUploadedDocs] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  const currentYear = new Date().getFullYear();
  const LICENSE_PLATE_REGEX = /^[A-Z0-9]{1,8}[-\s]?[A-Z0-9]{1,8}$/i;

  const handleSaveVehicle = async () => {
    if (!vehicleType || !vehicleMake.trim() || !vehicleModel.trim() || !vehicleYear || !vehicleColor.trim() || !licensePlate.trim()) {
      toast.error("Please fill in all vehicle details");
      return;
    }
    const yearNum = parseInt(vehicleYear);
    if (isNaN(yearNum) || yearNum < 2016 || yearNum > currentYear) {
      toast.error(`Vehicle year must be between 2016 and ${currentYear}`);
      return;
    }
    if (!LICENSE_PLATE_REGEX.test(licensePlate.trim())) {
      toast.error("Enter a valid license plate (letters and numbers, e.g. ABC-1234)");
      return;
    }
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
      setStep(2);
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
      const filePath = `${profile.id}/${docType}_${Date.now()}.${file.name.split(".").pop()}`;
      const { error: uploadError } = await supabase.storage
        .from("proof-photos")
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      // Use signed URL since proof-photos is a private bucket
      const { data: signedData, error: signedError } = await supabase.storage
        .from("proof-photos")
        .createSignedUrl(filePath, 60 * 60 * 24 * 365 * 5); // 5-year signed URL

      if (signedError) throw signedError;

      const { error: insertError } = await supabase.from("verifications").insert({
        driver_id: profile.id,
        document_type: docType,
        document_url: signedData.signedUrl,
        status: "pending",
      });
      if (insertError) throw insertError;

      setUploadedDocs((prev) => ({ ...prev, [docType]: true }));
      toast.success("Document uploaded successfully");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(null);
    }
  };

  const allDocsUploaded = REQUIRED_DOCUMENTS.every((d) => d.optional || uploadedDocs[d.type]);

  const handleFinish = () => {
    toast.success("Your application is under review. We'll notify you once approved!");
    navigate("/driver/onboarding/pending", { replace: true });
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-8 relative overflow-hidden"
      style={{
        background: "linear-gradient(180deg, hsl(220 30% 10%), hsl(220 30% 6%))",
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
           background:
            "radial-gradient(ellipse 60% 50% at 50% 40%, hsl(213 84% 56% / 0.06) 0%, transparent 70%)",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg"
      >
        <div className="text-center mb-6">
          <img
            src={logoImg}
            alt="PickYou"
            className="h-16 mx-auto rounded-xl mb-4 drop-shadow-[0_0_12px_hsl(var(--primary)/0.4)]"
          />
          <h1 className="text-xl font-semibold text-foreground">Driver Onboarding</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Complete your profile to start driving
          </p>

          {/* Steps indicator */}
          <div className="flex items-center justify-center gap-2 mt-4">
            {[1, 2].map((s) => (
              <div
                key={s}
                className={`h-2 rounded-full transition-all ${
                  s === step
                    ? "w-8 bg-primary"
                    : s < step
                    ? "w-8 bg-primary/50"
                    : "w-8 bg-muted"
                }`}
              />
            ))}
          </div>
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
          {step === 1 && (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Car className="h-5 w-5 text-primary" />
                  Vehicle Information
                </CardTitle>
                <CardDescription>
                  Tell us about the vehicle you'll be driving
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Vehicle Type</Label>
                    <Select value={vehicleType} onValueChange={setVehicleType}>
                      <SelectTrigger className="bg-secondary border-border">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {VEHICLE_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Seat Capacity</Label>
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
                  <div className="space-y-2">
                    <Label>Make</Label>
                    <Input
                      placeholder="e.g. Toyota"
                      value={vehicleMake}
                      onChange={(e) => setVehicleMake(e.target.value)}
                      className="bg-secondary border-border"
                      maxLength={50}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Model</Label>
                    <Input
                      placeholder="e.g. Corolla"
                      value={vehicleModel}
                      onChange={(e) => setVehicleModel(e.target.value)}
                      className="bg-secondary border-border"
                      maxLength={50}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label>Year</Label>
                    <Input
                      placeholder="2020"
                      value={vehicleYear}
                      onChange={(e) => setVehicleYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      className="bg-secondary border-border"
                      inputMode="numeric"
                    />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label>Color</Label>
                    <Input
                      placeholder="e.g. White"
                      value={vehicleColor}
                      onChange={(e) => setVehicleColor(e.target.value)}
                      className="bg-secondary border-border"
                      maxLength={30}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>License Plate</Label>
                  <Input
                    placeholder="e.g. ABC-1234"
                    value={licensePlate}
                    onChange={(e) => setLicensePlate(e.target.value)}
                    className="bg-secondary border-border uppercase"
                    maxLength={15}
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={handleSaveVehicle}
                  disabled={!vehicleType || !vehicleMake || !vehicleModel || !vehicleYear || !vehicleColor || !licensePlate || saving}
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Continue
                </Button>
              </CardContent>
            </>
          )}

          {step === 2 && (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="h-5 w-5 text-primary" />
                  Upload Documents
                </CardTitle>
                <CardDescription>
                  Upload the required documents for verification
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {REQUIRED_DOCUMENTS.map((doc) => (
                  <div
                    key={doc.type}
                    className="flex items-center justify-between rounded-lg border border-border bg-secondary/50 p-3"
                  >
                    <div className="flex items-center gap-3">
                      {uploadedDocs[doc.type] ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <Upload className="h-5 w-5 text-muted-foreground" />
                      )}
                      <span className="text-sm font-medium">
                        {doc.label}
                        {doc.optional && (
                          <span className="ml-1 text-xs text-muted-foreground font-normal">(optional)</span>
                        )}
                      </span>
                    </div>
                    {!uploadedDocs[doc.type] && (
                      <label>
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*,.pdf"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleUploadDocument(doc.type, file);
                          }}
                          disabled={uploading !== null}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          disabled={uploading !== null}
                        >
                          <span className="cursor-pointer">
                            {uploading === doc.type ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "Upload"
                            )}
                          </span>
                        </Button>
                      </label>
                    )}
                  </div>
                ))}
                <Button
                  className="w-full"
                  onClick={handleFinish}
                  disabled={!allDocsUploaded}
                >
                  Submit for Review
                </Button>
              </CardContent>
            </>
          )}
        </Card>

        <div className="mt-4 text-center">
          <button
            onClick={signOut}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
          >
            <LogOut className="h-3 w-3" />
            Sign out
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default DriverOnboarding;
