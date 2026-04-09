import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { CheckCircle, XCircle, FileText } from "lucide-react";
import AdminBreadcrumb from "@/components/admin/AdminBreadcrumb";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import ErrorRetry from "@/components/driver/ErrorRetry";

const AdminVerifications = () => {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: verifications, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-verifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("verifications")
        .select("*, driver:driver_id(full_name, phone)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = verifications?.filter(
    (v: any) => statusFilter === "all" || v.status === statusFilter
  ) || [];

  const REQUIRED_DOC_TYPES = ["drivers_license", "vehicle_insurance", "vehicle_registration"];

  const updateVerification = async (id: string, status: "approved" | "rejected") => {
    const verification = verifications?.find((v: any) => v.id === id);
    const { error } = await supabase
      .from("verifications")
      .update({ status, reviewer_notes: notes[id] || null })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }

    if (verification?.driver_id) {
      if (status === "approved") {
        await supabase
          .from("profiles")
          .update({
            launch_start_date: new Date().toISOString(),
            standard_commission_rate: 0.049,
          } as any)
          .eq("id", verification.driver_id);

        // Check if ALL required docs are now approved
        const { data: allVerifications } = await supabase
          .from("verifications")
          .select("document_type, status")
          .eq("driver_id", verification.driver_id);

        const allApproved = REQUIRED_DOC_TYPES.every((type) =>
          allVerifications?.some((v: any) => v.document_type === type && v.status === "approved")
        );

        if (allApproved) {
          // Send "fully approved" notification
          await supabase.from("notifications").insert({
            user_id: verification.driver_id,
            title: "You're Approved! 🎉",
            body: "All your documents have been verified. You can now start accepting rides!",
            type: "verification_approved",
          });
        } else {
          await supabase.from("notifications").insert({
            user_id: verification.driver_id,
            title: "Document Approved",
            body: `Your ${verification.document_type.replace(/_/g, " ")} has been approved.`,
            type: "verification_approved",
          });
        }
      } else {
        // Rejected
        await supabase.from("notifications").insert({
          user_id: verification.driver_id,
          title: "Document Rejected",
          body: `Your ${verification.document_type.replace(/_/g, " ")} was rejected.${notes[id] ? ` Reason: ${notes[id]}` : " Please re-upload."}`,
          type: "verification_rejected",
        });
      }
    }

    toast.success(`Verification ${status}`);
    queryClient.invalidateQueries({ queryKey: ["admin-verifications"] });
  };

  const statusBadge: Record<string, string> = {
    pending: "bg-yellow-400/10 text-yellow-400",
    approved: "bg-green-400/10 text-green-400",
    rejected: "bg-red-400/10 text-red-400",
  };

  return (
    <div className="space-y-6 pt-4">
      <AdminBreadcrumb />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Driver Verification Hub</h1>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isError ? (
        <ErrorRetry message="Failed to load verifications" onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No verification requests.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((v: any) => (
            <motion.div
              key={v.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="glass-surface rounded-lg p-5 space-y-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">{v.driver?.full_name || "Unknown Driver"}</p>
                  <p className="text-xs text-muted-foreground">{v.driver?.phone || "No phone"}</p>
                </div>
                <span className={`text-xs font-mono uppercase px-2 py-1 rounded ${statusBadge[v.status]}`}>
                  {v.status}
                </span>
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="h-4 w-4" />
                <span>{v.document_type}</span>
              </div>

              {v.document_url && (
                <a href={v.document_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                  View Document →
                </a>
              )}

              {v.status === "pending" && (
                <>
                  <Textarea
                    placeholder="Reviewer notes (optional)"
                    value={notes[v.id] || ""}
                    onChange={(e) => setNotes({ ...notes, [v.id]: e.target.value })}
                    className="bg-secondary text-sm"
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => updateVerification(v.id, "approved")}>
                      <CheckCircle className="h-4 w-4 mr-1" /> Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => updateVerification(v.id, "rejected")}>
                      <XCircle className="h-4 w-4 mr-1" /> Reject
                    </Button>
                  </div>
                </>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminVerifications;
