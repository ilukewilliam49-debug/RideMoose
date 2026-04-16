import { useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Clock,
  LogOut,
  AlertCircle,
  MessageCircle,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import logoImg from "@/assets/logo.png";
import NotificationBell from "@/components/NotificationBell";
import DocumentUploadCard from "@/components/driver/DocumentUploadCard";
import SupportChatDialog from "@/components/SupportChatDialog";
import { DRIVER_DOCUMENTS, REQUIRED_DOC_TYPES } from "@/lib/driver-documents";

const formatRelativeTime = (iso: string) => {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
};

const DriverOnboardingPending = () => {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
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
    refetchInterval: 15_000,
  });

  const latestByType = useMemo(() => {
    const acc: Record<string, any> = {};
    (verifications || []).forEach((v: any) => {
      if (!acc[v.document_type]) acc[v.document_type] = v;
    });
    return acc;
  }, [verifications]);

  const earliestSubmission = useMemo(() => {
    if (!verifications || verifications.length === 0) return null;
    const dates = verifications.map((v: any) => new Date(v.created_at).getTime());
    return new Date(Math.min(...dates)).toISOString();
  }, [verifications]);

  const requiredStatuses = REQUIRED_DOC_TYPES.map((t) => latestByType[t]?.status);
  const hasRejections = requiredStatuses.includes("rejected");
  const allApproved =
    requiredStatuses.length === REQUIRED_DOC_TYPES.length &&
    requiredStatuses.every((s) => s === "approved");

  const docStatus = (type: string) => {
    if (uploading === type) return "uploading" as const;
    const v = latestByType[type];
    if (!v) return "missing" as const;
    if (v.status === "approved") return "approved" as const;
    if (v.status === "rejected") return "rejected" as const;
    return "pending" as const;
  };

  const handleReupload = async (docType: string, file: File) => {
    if (!profile) return;
    setUploading(docType);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const filePath = `${profile.id}/${docType}_${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("proof-photos")
        .upload(filePath, file, { contentType: file.type });
      if (uploadError) throw uploadError;

      const { data: urlData } = await supabase.storage
        .from("proof-photos")
        .createSignedUrl(filePath, 60 * 60 * 24 * 7);

      const { error: insertError } = await supabase.from("verifications").insert({
        driver_id: profile.id,
        document_type: docType,
        document_url: urlData?.signedUrl || filePath,
        status: "pending",
      });
      if (insertError) throw insertError;

      const { data: admins } = await supabase
        .from("profiles")
        .select("id")
        .eq("role", "admin");
      if (admins && admins.length > 0) {
        await supabase.from("notifications").insert(
          admins.map((a: any) => ({
            user_id: a.id,
            title: "Document Re-uploaded",
            body: `${profile.full_name} re-uploaded ${
              DRIVER_DOCUMENTS.find((d) => d.type === docType)?.label || docType
            }.`,
            type: "verification_reupload",
          })),
        );
      }

      await queryClient.invalidateQueries({
        queryKey: ["driver-verifications", profile.id],
      });
      toast.success("Document re-uploaded — we'll review shortly.");
    } catch (err: any) {
      toast.error(err.message || "Upload failed.");
    } finally {
      setUploading(null);
    }
  };

  // Auto-redirect when fully approved
  if (allApproved) {
    setTimeout(() => navigate("/driver", { replace: true }), 100);
  }

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

      {/* Top-right actions */}
      <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
        <NotificationBell />
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
        className="w-full max-w-lg"
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
          <CardContent className="pt-6 space-y-4">
            {hasRejections ? (
              <div className="text-center">
                <div className="mx-auto w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertCircle className="h-7 w-7 text-destructive" />
                </div>
                <h1 className="text-xl font-semibold text-foreground mt-3">
                  Action required
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Some documents need to be re-uploaded. See the notes below.
                </p>
              </div>
            ) : allApproved ? (
              <div className="text-center">
                <div className="mx-auto w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle2 className="h-7 w-7 text-green-500" />
                </div>
                <h1 className="text-xl font-semibold text-foreground mt-3">
                  You're approved!
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Redirecting to your dashboard…
                </p>
              </div>
            ) : (
              <div className="text-center">
                <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <Clock className="h-7 w-7 text-primary" />
                </div>
                <h1 className="text-xl font-semibold text-foreground mt-3">
                  Application under review
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Most reviews complete within <strong className="text-foreground">24 hours</strong>.
                  We'll send you a notification.
                </p>
              </div>
            )}

            {/* Trust + timestamp banner */}
            {!allApproved && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground space-y-1.5">
                <div className="flex items-start gap-2">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                  <span>
                    Reviewed by the PickYou Operations team in Yellowknife.
                  </span>
                </div>
                {earliestSubmission && (
                  <div className="flex items-start gap-2">
                    <Clock className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                    <span>
                      Submitted {formatRelativeTime(earliestSubmission)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Document list */}
            <div className="space-y-3">
              {DRIVER_DOCUMENTS.filter((d) => !d.optional || latestByType[d.type]).map(
                (doc) => (
                  <DocumentUploadCard
                    key={doc.type}
                    doc={doc}
                    status={docStatus(doc.type)}
                    previewUrl={latestByType[doc.type]?.document_url}
                    reviewerNotes={latestByType[doc.type]?.reviewer_notes}
                    onUpload={(file) => handleReupload(doc.type, file)}
                    disabled={uploading !== null && uploading !== doc.type}
                  />
                ),
              )}
            </div>

            {/* Support */}
            {!allApproved && (
              <div className="rounded-lg border border-border bg-secondary/40 p-3 flex items-center justify-between gap-3">
                <div className="text-xs text-muted-foreground">
                  Questions about your application?
                </div>
                <SupportChatDialog
                  trigger={
                    <Button size="sm" variant="outline">
                      <MessageCircle className="h-3.5 w-3.5 mr-1.5" />
                      Contact support
                    </Button>
                  }
                />
              </div>
            )}

            {/* Browse as rider */}
            <div className="text-center pt-1">
              <button
                onClick={() => navigate("/rider")}
                className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
              >
                Use PickYou as a rider while you wait
              </button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default DriverOnboardingPending;
