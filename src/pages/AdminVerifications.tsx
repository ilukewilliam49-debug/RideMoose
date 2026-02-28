import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { CheckCircle, XCircle, FileText } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";

const AdminVerifications = () => {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState<Record<string, string>>({});

  const { data: verifications } = useQuery({
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

  const updateVerification = async (id: string, status: "approved" | "rejected") => {
    const { error } = await supabase
      .from("verifications")
      .update({ status, reviewer_notes: notes[id] || null })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }

    // When approving a driver, set 30-day 0% commission promo
    if (status === "approved") {
      const verification = verifications?.find((v: any) => v.id === id);
      if (verification?.driver_id) {
        const promoEnd = new Date();
        promoEnd.setDate(promoEnd.getDate() + 30);
        await supabase
          .from("profiles")
          .update({
            promo_commission_rate: 0,
            promo_end_date: promoEnd.toISOString(),
            commission_rate: 0.049,
          } as any)
          .eq("id", verification.driver_id);
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
      <h1 className="text-2xl font-bold">Driver Verification Hub</h1>

      {verifications?.length === 0 && (
        <p className="text-sm text-muted-foreground">No verification requests.</p>
      )}

      <div className="space-y-3">
        {verifications?.map((v: any) => (
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
              <a
                href={v.document_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline"
              >
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
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateVerification(v.id, "rejected")}
                  >
                    <XCircle className="h-4 w-4 mr-1" /> Reject
                  </Button>
                </div>
              </>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default AdminVerifications;
