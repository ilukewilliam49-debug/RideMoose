import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Plus, FileText, Loader2, Users, ChevronDown, ChevronUp, ClipboardList, CheckCircle, XCircle, HelpCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const AdminCorporate = () => {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [newOrg, setNewOrg] = useState({ name: "", billing_email: "", credit_limit_cents: 500000, payment_terms_days: 30 });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [invoicing, setInvoicing] = useState<string | null>(null);
  const [expandedOrg, setExpandedOrg] = useState<string | null>(null);

  // Member add dialog
  const [memberDialogOrg, setMemberDialogOrg] = useState<string | null>(null);
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberRole, setNewMemberRole] = useState("booker");
  const [addingMember, setAddingMember] = useState(false);

  // Application review
  const [reviewApp, setReviewApp] = useState<any | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewCreditLimit, setReviewCreditLimit] = useState(500000);
  const [reviewTerms, setReviewTerms] = useState(30);
  const [processing, setProcessing] = useState(false);

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

  const { data: applications } = useQuery({
    queryKey: ["org-applications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_applications")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: allInvoices } = useQuery({
    queryKey: ["all-invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .order("issue_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: allMembers } = useQuery({
    queryKey: ["all-org-members"],
    queryFn: async () => {
      const { data, error } = await supabase.from("org_members").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ["all-profiles-for-members"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, user_id, full_name, phone");
      if (error) throw error;
      return data;
    },
  });

  const pendingApps = applications?.filter((a) => a.status === "pending" || a.status === "needs_info") || [];

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

  const addMember = async () => {
    if (!memberDialogOrg || !newMemberEmail) return;
    setAddingMember(true);
    try {
      const { data: matchedProfiles, error: searchError } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .limit(100);
      if (searchError) throw searchError;
      const match = matchedProfiles?.find(
        (p) => p.full_name?.toLowerCase().includes(newMemberEmail.toLowerCase())
      );
      if (!match) throw new Error("No user found matching that name.");
      const { error } = await supabase.from("org_members").insert({
        organization_id: memberDialogOrg,
        user_id: match.user_id,
        role: newMemberRole,
      });
      if (error) {
        if (error.code === "23505") throw new Error("User is already a member");
        throw error;
      }
      toast.success(`Added ${match.full_name} as ${newMemberRole}`);
      setNewMemberEmail("");
      setNewMemberRole("booker");
      setMemberDialogOrg(null);
      queryClient.invalidateQueries({ queryKey: ["all-org-members"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setAddingMember(false);
    }
  };

  const removeMember = async (memberId: string) => {
    const { error } = await supabase.from("org_members").delete().eq("id", memberId);
    if (error) toast.error(error.message);
    else {
      toast.success("Member removed");
      queryClient.invalidateQueries({ queryKey: ["all-org-members"] });
    }
  };

  const generateInvoice = async (orgId: string) => {
    setInvoicing(orgId);
    try {
      const { data, error } = await supabase.functions.invoke("generate-monthly-invoices", {
        body: { organization_id: orgId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const result = data?.results?.[0];
      if (result?.skipped) {
        toast.info("No uninvoiced rides for the previous month.");
      } else if (result?.error) {
        throw new Error(result.error);
      } else {
        toast.success(`Invoice ${result.invoice_number}: ${result.ride_count} rides, $${(result.total_cents / 100).toFixed(2)}`);
      }
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      queryClient.invalidateQueries({ queryKey: ["all-invoices"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setInvoicing(null);
    }
  };

  const updateOrgStatus = async (orgId: string, status: string) => {
    const { error } = await supabase.from("organizations").update({ status }).eq("id", orgId);
    if (error) toast.error(error.message);
    else {
      toast.success(`Status → ${status}`);
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
    }
  };

  const updateInvoiceStatus = async (invoiceId: string, status: string) => {
    const { error } = await supabase.from("invoices").update({ status }).eq("id", invoiceId);
    if (error) toast.error(error.message);
    else {
      toast.success(`Invoice marked as ${status}`);
      queryClient.invalidateQueries({ queryKey: ["all-invoices"] });
    }
  };

  // Application approval flow
  const approveApplication = async () => {
    if (!reviewApp) return;
    setProcessing(true);
    try {
      // 1. Create org
      const { data: newOrgData, error: orgError } = await supabase
        .from("organizations")
        .insert({
          name: reviewApp.company_name,
          billing_email: reviewApp.billing_email,
          accounts_payable_email: reviewApp.accounts_payable_email || null,
          credit_limit_cents: reviewCreditLimit,
          payment_terms_days: reviewTerms,
          status: "approved",
        })
        .select("id")
        .single();
      if (orgError) throw orgError;

      // 2. Add applicant as org admin
      const { error: memberError } = await supabase.from("org_members").insert({
        organization_id: newOrgData.id,
        user_id: reviewApp.applicant_user_id,
        role: "admin",
      });
      if (memberError) throw memberError;

      // 3. Update application status
      const { error: appError } = await supabase
        .from("organization_applications")
        .update({ status: "approved", admin_notes: reviewNotes || null })
        .eq("id", reviewApp.id);
      if (appError) throw appError;

      toast.success(`${reviewApp.company_name} approved and organization created!`);
      setReviewApp(null);
      setReviewNotes("");
      queryClient.invalidateQueries({ queryKey: ["org-applications"] });
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      queryClient.invalidateQueries({ queryKey: ["all-org-members"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const rejectApplication = async () => {
    if (!reviewApp) return;
    setProcessing(true);
    try {
      const { error } = await supabase
        .from("organization_applications")
        .update({ status: "rejected", admin_notes: reviewNotes || null })
        .eq("id", reviewApp.id);
      if (error) throw error;
      toast.success("Application rejected");
      setReviewApp(null);
      setReviewNotes("");
      queryClient.invalidateQueries({ queryKey: ["org-applications"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const requestInfoApplication = async () => {
    if (!reviewApp || !reviewNotes) {
      toast.error("Please add a note explaining what info is needed.");
      return;
    }
    setProcessing(true);
    try {
      const { error } = await supabase
        .from("organization_applications")
        .update({ status: "needs_info", admin_notes: reviewNotes })
        .eq("id", reviewApp.id);
      if (error) throw error;
      toast.success("Requested additional info from applicant");
      setReviewApp(null);
      setReviewNotes("");
      queryClient.invalidateQueries({ queryKey: ["org-applications"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const statusColor: Record<string, string> = {
    pending: "text-yellow-500",
    approved: "text-green-500",
    suspended: "text-destructive",
    rejected: "text-destructive",
    needs_info: "text-orange-500",
    issued: "text-yellow-500",
    paid: "text-green-500",
    overdue: "text-destructive",
    void: "text-muted-foreground",
  };

  const getOrgInvoices = (orgId: string) => allInvoices?.filter((i) => i.organization_id === orgId) || [];
  const getOrgMembers = (orgId: string) => allMembers?.filter((m) => m.organization_id === orgId) || [];
  const getProfileName = (userId: string) => profiles?.find((p) => p.user_id === userId)?.full_name || userId.slice(0, 8);

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
            <DialogHeader><DialogTitle>New Organization</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={newOrg.name} onChange={(e) => setNewOrg({ ...newOrg, name: e.target.value })} /></div>
              <div><Label>Billing Email</Label><Input type="email" value={newOrg.billing_email} onChange={(e) => setNewOrg({ ...newOrg, billing_email: e.target.value })} /></div>
              <div><Label>Credit Limit ($)</Label><Input type="number" value={newOrg.credit_limit_cents / 100} onChange={(e) => setNewOrg({ ...newOrg, credit_limit_cents: Math.round(parseFloat(e.target.value || "0") * 100) })} /></div>
              <div><Label>Payment Terms (days)</Label><Input type="number" value={newOrg.payment_terms_days} onChange={(e) => setNewOrg({ ...newOrg, payment_terms_days: parseInt(e.target.value) || 30 })} /></div>
              <Button onClick={createOrg} disabled={creating || !newOrg.name || !newOrg.billing_email} className="w-full">
                {creating ? "Creating..." : "Create Organization"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Add Member Dialog */}
      <Dialog open={!!memberDialogOrg} onOpenChange={(open) => { if (!open) setMemberDialogOrg(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Member</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>User Name (search)</Label><Input placeholder="Type user's display name..." value={newMemberEmail} onChange={(e) => setNewMemberEmail(e.target.value)} /></div>
            <div>
              <Label>Role</Label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {["admin", "booker", "viewer"].map((r) => (
                  <button key={r} type="button" onClick={() => setNewMemberRole(r)}
                    className={`p-2 rounded-lg border text-xs font-semibold capitalize transition-all ${newMemberRole === r ? "border-primary bg-primary/10" : "border-border bg-secondary"}`}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <Button onClick={addMember} disabled={addingMember || !newMemberEmail} className="w-full">
              {addingMember ? "Adding..." : "Add Member"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Review Application Dialog */}
      <Dialog open={!!reviewApp} onOpenChange={(open) => { if (!open) { setReviewApp(null); setReviewNotes(""); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Review Application</DialogTitle></DialogHeader>
          {reviewApp && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-[10px] text-muted-foreground">Company</p><p className="font-semibold">{reviewApp.company_name}</p></div>
                <div><p className="text-[10px] text-muted-foreground">Registration #</p><p className="font-mono text-xs">{reviewApp.registration_number || "—"}</p></div>
                <div><p className="text-[10px] text-muted-foreground">Billing Email</p><p className="font-mono text-xs">{reviewApp.billing_email}</p></div>
                <div><p className="text-[10px] text-muted-foreground">AP Email</p><p className="font-mono text-xs">{reviewApp.accounts_payable_email || "—"}</p></div>
                <div><p className="text-[10px] text-muted-foreground">Phone</p><p className="text-xs">{reviewApp.phone || "—"}</p></div>
                <div><p className="text-[10px] text-muted-foreground">Address</p><p className="text-xs">{reviewApp.address || "—"}</p></div>
                <div><p className="text-[10px] text-muted-foreground">Contact Name</p><p className="text-xs">{reviewApp.contact_person_name}</p></div>
                <div><p className="text-[10px] text-muted-foreground">Contact Email</p><p className="font-mono text-xs">{reviewApp.contact_person_email}</p></div>
                <div><p className="text-[10px] text-muted-foreground">Est. Monthly Spend</p><p className="font-mono text-xs">${(reviewApp.estimated_monthly_spend_cents / 100).toFixed(2)}</p></div>
                <div><p className="text-[10px] text-muted-foreground">Submitted</p><p className="font-mono text-xs">{new Date(reviewApp.created_at).toLocaleDateString()}</p></div>
              </div>

              <div className="border-t border-border pt-3 space-y-3">
                <Label className="text-xs text-muted-foreground">Approval Settings</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Credit Limit ($)</Label>
                    <Input type="number" value={reviewCreditLimit / 100} onChange={(e) => setReviewCreditLimit(Math.round(parseFloat(e.target.value || "0") * 100))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Payment Terms (days)</Label>
                    <Input type="number" value={reviewTerms} onChange={(e) => setReviewTerms(parseInt(e.target.value) || 30)} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Admin Notes</Label>
                  <Textarea value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} placeholder="Internal notes or info request for applicant..." rows={3} />
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={approveApplication} disabled={processing} className="flex-1 gap-1.5">
                  <CheckCircle className="h-4 w-4" /> Approve
                </Button>
                <Button variant="outline" onClick={requestInfoApplication} disabled={processing} className="gap-1.5">
                  <HelpCircle className="h-4 w-4" /> Request Info
                </Button>
                <Button variant="destructive" onClick={rejectApplication} disabled={processing} className="gap-1.5">
                  <XCircle className="h-4 w-4" /> Reject
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Applications section */}
      {pendingApps.length > 0 && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4 space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-yellow-500" />
            Pending Applications ({pendingApps.length})
          </h2>
          <div className="space-y-2">
            {pendingApps.map((app) => (
              <div key={app.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary">
                <div>
                  <p className="text-sm font-semibold">{app.company_name}</p>
                  <p className="text-xs text-muted-foreground">{app.contact_person_name} • {app.billing_email}</p>
                  <p className="text-[10px] text-muted-foreground">
                    Requested: ${(app.requested_credit_limit_cents / 100).toFixed(0)} limit, Net {app.payment_terms_requested}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-mono uppercase ${statusColor[app.status] || ""}`}>{app.status.replace("_", " ")}</span>
                  <Button size="sm" onClick={() => {
                    setReviewApp(app);
                    setReviewCreditLimit(app.requested_credit_limit_cents);
                    setReviewTerms(app.payment_terms_requested);
                    setReviewNotes(app.admin_notes || "");
                  }}>Review</Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Applications history */}
      {applications && applications.length > 0 && (
        <details className="group">
          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
            All Applications ({applications.length})
          </summary>
          <div className="mt-2 space-y-1">
            {applications.map((app) => (
              <div key={app.id} className="flex items-center justify-between p-2 rounded bg-secondary text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{app.company_name}</span>
                  <span className={`text-[10px] font-mono uppercase ${statusColor[app.status] || ""}`}>{app.status.replace("_", " ")}</span>
                </div>
                <span className="text-[10px] text-muted-foreground">{new Date(app.created_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </details>
      )}

      {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}

      {/* Organizations list */}
      <div className="space-y-4">
        {orgs?.map((org) => {
          const orgInvoices = getOrgInvoices(org.id);
          const orgMembers = getOrgMembers(org.id);
          const isExpanded = expandedOrg === org.id;

          return (
            <div key={org.id} className="glass-surface rounded-lg overflow-hidden">
              <div className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{org.name}</h3>
                    <p className="text-xs text-muted-foreground">{org.billing_email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-mono uppercase ${statusColor[org.status] || ""}`}>{org.status}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpandedOrg(isExpanded ? null : org.id)}>
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-md bg-secondary p-2">
                    <p className="text-[10px] text-muted-foreground">Balance</p>
                    <p className="text-sm font-mono font-bold">${(org.current_balance_cents / 100).toFixed(2)}</p>
                  </div>
                  <div className="rounded-md bg-secondary p-2">
                    <p className="text-[10px] text-muted-foreground">Limit</p>
                    <p className="text-sm font-mono">${(org.credit_limit_cents / 100).toFixed(2)}</p>
                  </div>
                  <div className="rounded-md bg-secondary p-2">
                    <p className="text-[10px] text-muted-foreground">Terms</p>
                    <p className="text-sm font-mono">Net {org.payment_terms_days}</p>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="outline" className="gap-1.5" disabled={invoicing === org.id} onClick={() => generateInvoice(org.id)}>
                    {invoicing === org.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                    Generate Invoice
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setMemberDialogOrg(org.id)}>
                    <Users className="h-3.5 w-3.5" /> Add Member
                  </Button>
                  {org.status === "pending" && <Button size="sm" onClick={() => updateOrgStatus(org.id, "approved")}>Approve</Button>}
                  {org.status === "approved" && <Button size="sm" variant="destructive" onClick={() => updateOrgStatus(org.id, "suspended")}>Suspend</Button>}
                  {org.status === "suspended" && <Button size="sm" onClick={() => updateOrgStatus(org.id, "approved")}>Reactivate</Button>}
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-border p-5">
                  <Tabs defaultValue="members">
                    <TabsList className="mb-3">
                      <TabsTrigger value="members" className="gap-1.5"><Users className="h-3.5 w-3.5" /> Members ({orgMembers.length})</TabsTrigger>
                      <TabsTrigger value="invoices" className="gap-1.5"><FileText className="h-3.5 w-3.5" /> Invoices ({orgInvoices.length})</TabsTrigger>
                    </TabsList>

                    <TabsContent value="members">
                      {orgMembers.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No members yet.</p>
                      ) : (
                        <div className="space-y-1">
                          {orgMembers.map((m) => (
                            <div key={m.id} className="flex items-center justify-between p-2 rounded bg-secondary text-sm">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{getProfileName(m.user_id)}</span>
                                <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-background">{m.role}</span>
                              </div>
                              <Button variant="ghost" size="sm" className="h-6 text-xs text-destructive" onClick={() => removeMember(m.id)}>Remove</Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="invoices">
                      {orgInvoices.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No invoices generated yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {orgInvoices.map((inv) => (
                            <div key={inv.id} className="rounded-lg border border-border p-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-medium">{(inv as any).invoice_number || `${inv.period_start} → ${inv.period_end}`}</p>
                                  <p className="text-xs text-muted-foreground">Issued: {inv.issue_date} • Due: {inv.due_date}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-mono font-bold">${(inv.total_cents / 100).toFixed(2)}</p>
                                  <p className={`text-[10px] font-mono uppercase ${statusColor[inv.status] || ""}`}>{inv.status}</p>
                                </div>
                              </div>
                              <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>{inv.ride_count} ride{inv.ride_count !== 1 ? "s" : ""}</span>
                                <div className="flex gap-1">
                                  {inv.status === "issued" && (
                                    <>
                                      <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => updateInvoiceStatus(inv.id, "paid")}>Mark Paid</Button>
                                      <Button size="sm" variant="ghost" className="h-6 text-[10px] text-destructive" onClick={() => updateInvoiceStatus(inv.id, "void")}>Void</Button>
                                    </>
                                  )}
                                  {inv.status === "overdue" && (
                                    <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => updateInvoiceStatus(inv.id, "paid")}>Mark Paid</Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </div>
              )}
            </div>
          );
        })}

        {!isLoading && (!orgs || orgs.length === 0) && (
          <p className="text-sm text-muted-foreground text-center py-8">No organizations yet.</p>
        )}
      </div>
    </div>
  );
};

export default AdminCorporate;
