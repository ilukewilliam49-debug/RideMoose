import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, ExternalLink } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import EmptyState from "@/components/EmptyState";
import { Button } from "@/components/ui/button";

const formatMoney = (cents: number | null | undefined) =>
  `$${((cents ?? 0) / 100).toFixed(2)}`;

const statusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
  if (status === "paid") return "default";
  if (status === "overdue") return "destructive";
  if (status === "void") return "outline";
  return "secondary";
};

const BusinessInvoices = () => {
  const { profile } = useAuth();

  const { data: orgId } = useQuery({
    queryKey: ["business-org-id", profile?.user_id],
    queryFn: async () => {
      if (!profile?.user_id) return null;
      const { data } = await supabase
        .from("org_members")
        .select("organization_id")
        .eq("user_id", profile.user_id)
        .maybeSingle();
      return data?.organization_id || profile.organization_id || null;
    },
    enabled: !!profile?.user_id,
  });

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["business-invoices", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await supabase
        .from("invoices")
        .select("*")
        .eq("organization_id", orgId)
        .order("issue_date", { ascending: false });
      return data || [];
    },
    enabled: !!orgId,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary" />
          Invoices
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Monthly statements for your organization.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All invoices</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : !invoices?.length ? (
            <EmptyState
              icon={FileText}
              title="No invoices yet"
              description="Invoices will appear here once your organization completes its first billing cycle."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Rides</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">PDF</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-xs">
                      {inv.invoice_number || inv.id.slice(0, 8)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(inv.period_start).toLocaleDateString()} –{" "}
                      {new Date(inv.period_end).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(inv.due_date).toLocaleDateString()}
                    </TableCell>
                    <TableCell>{inv.ride_count}</TableCell>
                    <TableCell className="font-mono font-semibold">
                      {formatMoney(inv.total_cents)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(inv.status)} className="capitalize">
                        {inv.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {inv.pdf_url ? (
                        <Button asChild variant="ghost" size="sm">
                          <a href={inv.pdf_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BusinessInvoices;
