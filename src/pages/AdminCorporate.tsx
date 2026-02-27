import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Plus, FileText, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Invoice {
  organization_name: string;
  total_cents: number;
  ride_count: number;
  generated_at: string;
  rides: { id: string; pickup: string; dropoff: string; fare_cents: number; completed_at: string; service_type: string }[];
}

const AdminCorporate = () => {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [newOrg, setNewOrg] = useState({ name: "", billing_email: "", credit_limit_cents: 500000, payment_terms_days: 30 });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [invoicing, setInvoicing] = useState<string | null>(null);
  const [lastInvoice, setLastInvoice] = useState<Invoice | null>(null);

  const { data: orgs, isLoading } = useQuery({
    queryKey: ["organizations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createOrg = async () => {
    setCreating(true);
    try {
      const { error } = await supabase.from("organizations").insert({
        name: newOrg.name,
        billing_email: newOrg.billing_email,
        credit_limit_cents: newOrg.credit_limit_cents,
        payment_terms_days: newOrg.payment_terms_days,
        status: "approved",
      });
      if (error) throw error;
      toast.success("Organization created!");
      setNewOrg({ name: "", billing_email: "", credit_limit_cents: 500000, payment_terms_days: 30 });
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  };

  const generateInvoice = async (orgId: string) => {
    setInvoicing(orgId);
    setLastInvoice(null);
    try {
      const { data, error } = await supabase.functions.invoke("generate-invoice", {
        body: { organization_id: orgId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setLastInvoice(data as Invoice);
      toast.success(`Invoice generated: ${data.ride_count} rides, $${(data.total_cents / 100).toFixed(2)}`);
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setInvoicing(null);
    }
  };

  const updateStatus = async (orgId: string, status: string) => {
    const { error } = await supabase
      .from("organizations")
      .update({ status })
      .eq("id", orgId);
    if (error) toast.error(error.message);
    else {
      toast.success(`Status updated to ${status}`);
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
    }
  };

  const statusColor: Record<string, string> = {
    pending: "text-yellow-500",
    approved: "text-green-500",
    suspended: "text-destructive",
  };

  return (
    <div className="space-y-6 pt-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Building2 className="h-6 w-6" /> Corporate Accounts
        </h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> Add Organization
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Organization</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Name</Label>
                <Input value={newOrg.name} onChange={(e) => setNewOrg({ ...newOrg, name: e.target.value })} />
              </div>
              <div>
                <Label>Billing Email</Label>
                <Input type="email" value={newOrg.billing_email} onChange={(e) => setNewOrg({ ...newOrg, billing_email: e.target.value })} />
              </div>
              <div>
                <Label>Credit Limit ($)</Label>
                <Input
                  type="number"
                  value={newOrg.credit_limit_cents / 100}
                  onChange={(e) => setNewOrg({ ...newOrg, credit_limit_cents: Math.round(parseFloat(e.target.value || "0") * 100) })}
                />
              </div>
              <div>
                <Label>Payment Terms (days)</Label>
                <Input
                  type="number"
                  value={newOrg.payment_terms_days}
                  onChange={(e) => setNewOrg({ ...newOrg, payment_terms_days: parseInt(e.target.value) || 30 })}
                />
              </div>
              <Button onClick={createOrg} disabled={creating || !newOrg.name || !newOrg.billing_email} className="w-full">
                {creating ? "Creating..." : "Create Organization"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}

      <div className="space-y-3">
        {orgs?.map((org) => (
          <div key={org.id} className="glass-surface rounded-lg p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">{org.name}</h3>
                <p className="text-xs text-muted-foreground">{org.billing_email}</p>
              </div>
              <span className={`text-xs font-mono uppercase ${statusColor[org.status] || ""}`}>
                {org.status}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-md bg-secondary p-2">
                <p className="text-[10px] text-muted-foreground">Balance</p>
                <p className="text-sm font-mono font-bold">${(org.current_balance_cents / 100).toFixed(2)}</p>
              </div>
              <div className="rounded-md bg-secondary p-2">
                <p className="text-[10px] text-muted-foreground">Credit Limit</p>
                <p className="text-sm font-mono">${(org.credit_limit_cents / 100).toFixed(2)}</p>
              </div>
              <div className="rounded-md bg-secondary p-2">
                <p className="text-[10px] text-muted-foreground">Terms</p>
                <p className="text-sm font-mono">Net {org.payment_terms_days}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                disabled={invoicing === org.id}
                onClick={() => generateInvoice(org.id)}
              >
                {invoicing === org.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                Generate Invoice
              </Button>
              {org.status === "pending" && (
                <Button size="sm" variant="default" onClick={() => updateStatus(org.id, "approved")}>
                  Approve
                </Button>
              )}
              {org.status === "approved" && (
                <Button size="sm" variant="destructive" onClick={() => updateStatus(org.id, "suspended")}>
                  Suspend
                </Button>
              )}
              {org.status === "suspended" && (
                <Button size="sm" variant="default" onClick={() => updateStatus(org.id, "approved")}>
                  Reactivate
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Invoice preview */}
      {lastInvoice && (
        <div className="glass-surface rounded-lg p-5 space-y-3 border border-primary/30">
          <h3 className="font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" /> Invoice Preview
          </h3>
          <div className="text-sm space-y-1">
            <p><strong>{lastInvoice.organization_name}</strong></p>
            <p className="text-muted-foreground">Generated: {new Date(lastInvoice.generated_at).toLocaleString()}</p>
            <p className="text-lg font-mono font-bold">${(lastInvoice.total_cents / 100).toFixed(2)} — {lastInvoice.ride_count} ride{lastInvoice.ride_count !== 1 ? "s" : ""}</p>
          </div>
          <div className="max-h-60 overflow-y-auto space-y-1">
            {lastInvoice.rides.map((r) => (
              <div key={r.id} className="flex items-center justify-between text-xs p-2 rounded bg-secondary">
                <span className="truncate flex-1">{r.pickup} → {r.dropoff}</span>
                <span className="font-mono ml-2">${(r.fare_cents / 100).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCorporate;
