import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, LogOut, CheckCircle2, XCircle, Upload, Loader2, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import logoImg from "@/assets/logo.png";
import NotificationBell from "@/components/NotificationBell";

const DOC_LABELS: Record<string, string> = {
  drivers_license: "Driver's License",
  vehicle_insurance: "Vehicle Insurance",
  vehicle_registration: "Vehicle Registration",
};

const DriverOnboardingPending = () => {
  const { profile, signOut } = useAuth();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState<string | null>(null);

  const { data: verifications } = useQuery({
    queryKey: ["driver-verifications", profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("verifications")
        .select("*")
        .eq("driver_id", profile!.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!profile?.id,
  });

  // Deduplicate: keep only latest per document_type
  const latestByType = verifications?.reduce((acc: Record<string, any>, v: any) => {
    if (!acc[v.document_type]) acc[v.document_type] = v;
    return acc;
  }, {} as Record<string, any>) || {};

  const rejectedDocs = Object.values(latestByType).filter((v: any) => v.status === "rejected");
  const hasRejections = rejectedDocs.length > 0;

  const handleReupload = async (docType: string, file: File) => {
    if (!profile) return;
    setUploading(docType);
    try {
      const filePath = `${profile.id}/${docType}_${Date.now()}.${file.name.split(".").pop()}`;
      const { error: uploadError } = await supabase.storage
        .from("proof-photos")
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = await supabase.storage
        .from("proof-photos")
        .createSignedUrl(filePath, 60 * 60 * 24 * 365);

      const { error: insertError } = await supabase.from("verifications").insert({
        driver_id: profile.id,
        document_type: docType,
        document_url: urlData?.signedUrl || filePath,
        status: "pending",
      });
      if (insertError) throw insertError;

      // Notify admins about re-upload
      const { data: admins } = await supabase
        .from("profiles")
        .select("id")
        .eq("role", "admin");

      if (admins && admins.length > 0) {
        const notifications = admins.map((admin: any) => ({
          user_id: admin.id,
          title: "Document Re-uploaded",
          body: `${profile.full_name} re-uploaded their ${DOC_LABELS[docType] || docType} for review.`,
          type: "verification_reupload",
        }));
        await supabase.from("notifications").insert(notifications);
      }

      queryClient.invalidateQueries({ queryKey: ["driver-verifications", profile.id] });
      toast.success("Document re-uploaded successfully");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(null);
    }
  };

  const statusIcon = (status: string) => {
    if (status === "approved") return <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />;
    if (status === "rejected") return <XCircle className="h-4 w-4 text-destructive shrink-0" />;
    return <Clock className="h-4 w-4 text-primary shrink-0" />;
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden"
      style={{
        background: "linear-gradient(180deg, hsl(220 30% 10%), hsl(220 30% 6%))",
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 40%, hsl(45 95% 55% / 0.06) 0%, transparent 70%)",
        }}
      />

      {/* Notification bell in top-right */}
      <div className="absolute top-4 right-4 z-50">
        <NotificationBell />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md text-center"
      >
        <img
          src={logoImg}
          alt="PickYou"
          className="h-16 mx-auto rounded-xl mb-6 drop-shadow-[0_0_12px_hsl(var(--primary)/0.4)]"
        />

        <Card
          className="border-border/50 backdrop-blur-xl"
          style={{
            background:
              "linear-gradient(135deg, hsl(220 28% 14% / 0.8), hsl(220 30% 10% / 0.9))",
            boxShadow:
              "0 0 40px -10px hsl(45 95% 55% / 0.12), 0 4px 24px -4px hsl(0 0% 0% / 0.4), inset 0 1px 0 0 hsl(0 0% 100% / 0.05)",
          }}
        >
          <CardContent className="pt-6 space-y-4">
            {hasRejections ? (
              <>
                <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertCircle className="h-8 w-8 text-destructive" />
                </div>
                <h1 className="text-xl font-semibold text-foreground">
                  Action Required
                </h1>
                <p className="text-sm text-muted-foreground">
                  Some documents were rejected. Please re-upload them to continue.
                </p>
              </>
            ) : (
              <>
                <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Clock className="h-8 w-8 text-primary" />
                </div>
                <h1 className="text-xl font-semibold text-foreground">
                  Application Under Review
                </h1>
                <p className="text-sm text-muted-foreground">
                  Your documents have been submitted and are being reviewed by our team.
                  You'll receive a notification once your account is approved.
                </p>
              </>
            )}

            {/* Document statuses */}
            <div className="space-y-2 text-left">
              {Object.entries(DOC_LABELS).map(([type, label]) => {
                const doc = latestByType[type];
                const status = doc?.status || "missing";
                return (
                  <div
                    key={type}
                    className={`rounded-lg border p-3 ${
                      status === "rejected"
                        ? "border-destructive/50 bg-destructive/5"
                        : "border-border bg-secondary/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {statusIcon(status)}
                        <span className="text-sm font-medium">{label}</span>
                      </div>
                      <span
                        className={`text-xs capitalize ${
                          status === "approved"
                            ? "text-green-500"
                            : status === "rejected"
                            ? "text-destructive"
                            : "text-primary"
                        }`}
                      >
                        {status}
                      </span>
                    </div>

                    {status === "rejected" && doc?.reviewer_notes && (
                      <p className="text-xs text-destructive/80 mt-1.5 ml-6">
                        {doc.reviewer_notes}
                      </p>
                    )}

                    {status === "rejected" && (
                      <div className="mt-2 ml-6">
                        <label>
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*,.pdf"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleReupload(type, file);
                            }}
                            disabled={uploading !== null}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                            disabled={uploading !== null}
                          >
                            <span className="cursor-pointer inline-flex items-center gap-1.5">
                              {uploading === type ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Upload className="h-3 w-3" />
                              )}
                              Re-upload
                            </span>
                          </Button>
                        </label>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <Button variant="outline" onClick={signOut} className="mt-4">
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default DriverOnboardingPending;
