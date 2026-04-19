import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, FileText, Car, DollarSign, AlertCircle } from "lucide-react";
import { Link, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

const formatMoney = (cents: number | null | undefined) =>
  `$${((cents ?? 0) / 100).toFixed(2)}`;

const BusinessDashboard = () => {
  const { profile } = useAuth();

  const { data: org, isLoading: orgLoading } = useQuery({
    queryKey: ["business-org", profile?.user_id],
    queryFn: async () => {
      if (!profile?.user_id) return null;
      // Try via org_members first, then via profiles.organization_id
      const { data: member } = await supabase
        .from("org_members")
        .select("organization_id, role, organizations(*)")
        .eq("user_id", profile.user_id)
        .maybeSingle();
      if (member?.organizations) {
        return { ...(member.organizations as any), member_role: member.role };
      }
      if (profile.organization_id) {
        const { data } = await supabase
          .from("organizations")
          .select("*")
          .eq("id", profile.organization_id)
          .maybeSingle();
        if (data) return { ...data, member_role: profile.role_in_org || "member" };
      }
      return null;
    },
    enabled: !!profile?.user_id,
  });

  const { data: pendingApp } = useQuery({
    queryKey: ["business-pending-app", profile?.user_id],
    queryFn: async () => {
      if (!profile?.user_id) return null;
      const { data } = await supabase
        .from("organization_applications")
        .select("*")
        .eq("applicant_user_id", profile.user_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!profile?.user_id && !org,
  });

  const { data: stats } = useQuery({
    queryKey: ["business-stats", org?.id],
    queryFn: async () => {
      if (!org?.id) return null;
      const [ridesRes, invoicesRes, membersRes] = await Promise.all([
        supabase
          .from("rides")
          .select("id, final_price, status, created_at")
          .eq("organization_id", org.id),
        supabase
          .from("invoices")
          .select("id, status, total_cents, due_date")
          .eq("organization_id", org.id),
        supabase
          .from("org_members")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", org.id),
      ]);
      const rides = ridesRes.data || [];
      const invoices = invoicesRes.data || [];
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const monthRides = rides.filter(
        (r) => r.created_at && new Date(r.created_at) >= monthStart,
      );
      const monthSpend = monthRides
        .filter((r) => r.status === "completed")
        .reduce((s, r) => s + Math.round(Number(r.final_price ?? 0) * 100), 0);
      const outstanding = invoices
        .filter((i) => i.status === "issued" || i.status === "overdue")
        .reduce((s, i) => s + (i.total_cents ?? 0), 0);
      return {
        totalRides: rides.length,
        monthRides: monthRides.length,
        monthSpend,
        outstandingCents: outstanding,
        memberCount: membersRes.count ?? 0,
        invoiceCount: invoices.length,
      };
    },
    enabled: !!org?.id,
  });

  if (orgLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </div>
    );
  }

  // No org yet — show application status / CTA
  if (!org) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <Building2 className="h-12 w-12 mx-auto text-primary" />
          <h1 className="text-2xl font-bold">Business workspace</h1>
          <p className="text-muted-foreground">
            You haven't joined an organization yet.
          </p>
        </div>
        {pendingApp ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-primary" />
                Application {pendingApp.status}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm">
                <span className="font-medium">{pendingApp.company_name}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                Submitted {new Date(pendingApp.created_at).toLocaleDateString()}
              </p>
              {pendingApp.status === "pending" && (
                <p className="text-sm text-muted-foreground">
                  Our team is reviewing your application. You'll receive an email when it's approved.
                </p>
              )}
              {pendingApp.status === "needs_info" && pendingApp.admin_notes && (
                <div className="rounded-md bg-muted p-3 text-sm">
                  <p className="font-medium mb-1">Admin notes:</p>
                  <p>{pendingApp.admin_notes}</p>
                </div>
              )}
              {pendingApp.status === "rejected" && (
                <p className="text-sm text-destructive">
                  Your application was not approved. Contact support for details.
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-6 text-center space-y-4">
              <p>Apply to set up corporate billing for your team.</p>
              <Button asChild>
                <Link to="/business/apply">Apply for business account</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            {org.name}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant={org.status === "approved" ? "default" : "secondary"}>
              {org.status}
            </Badge>
            <span className="text-xs text-muted-foreground capitalize">
              You · {org.member_role}
            </span>
          </div>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/rider">Book a ride</Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Car className="h-4 w-4" />}
          label="Rides this month"
          value={String(stats?.monthRides ?? 0)}
          sub={`${stats?.totalRides ?? 0} all-time`}
        />
        <StatCard
          icon={<DollarSign className="h-4 w-4" />}
          label="Spend this month"
          value={formatMoney(stats?.monthSpend)}
        />
        <StatCard
          icon={<FileText className="h-4 w-4" />}
          label="Outstanding"
          value={formatMoney(stats?.outstandingCents)}
          sub={`${stats?.invoiceCount ?? 0} invoices total`}
          highlight={(stats?.outstandingCents ?? 0) > 0}
        />
        <StatCard
          icon={<Users className="h-4 w-4" />}
          label="Team members"
          value={String(stats?.memberCount ?? 0)}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <QuickLink
          to="/business/members"
          icon={<Users className="h-5 w-5" />}
          title="Members"
          description="Manage who can book on the company account."
        />
        <QuickLink
          to="/business/invoices"
          icon={<FileText className="h-5 w-5" />}
          title="Invoices"
          description="View statements and payment status."
        />
        <QuickLink
          to="/business/rides"
          icon={<Car className="h-5 w-5" />}
          title="Ride history"
          description="Track all rides billed to your organization."
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <DetailRow label="Billing email" value={org.billing_email} />
          <DetailRow label="AP email" value={org.accounts_payable_email || "—"} />
          <DetailRow
            label="Credit limit"
            value={formatMoney(org.credit_limit_cents)}
          />
          <DetailRow
            label="Current balance"
            value={formatMoney(org.current_balance_cents)}
          />
          <DetailRow label="Payment terms" value={`Net ${org.payment_terms_days}`} />
        </CardContent>
      </Card>
    </div>
  );
};

const StatCard = ({
  icon,
  label,
  value,
  sub,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) => (
  <Card className={highlight ? "border-primary/40" : undefined}>
    <CardContent className="pt-6">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-2xl font-bold font-mono">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </CardContent>
  </Card>
);

const QuickLink = ({
  to,
  icon,
  title,
  description,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) => (
  <Link
    to={to}
    className="rounded-lg border border-border bg-card p-4 hover:bg-accent/50 transition-colors block"
  >
    <div className="flex items-center gap-2 mb-1">
      <span className="text-primary">{icon}</span>
      <span className="font-semibold">{title}</span>
    </div>
    <p className="text-sm text-muted-foreground">{description}</p>
  </Link>
);

const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between border-b border-border/40 pb-2">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-medium">{value}</span>
  </div>
);

export default BusinessDashboard;
