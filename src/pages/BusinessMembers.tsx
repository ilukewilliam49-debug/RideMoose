import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import EmptyState from "@/components/EmptyState";

const BusinessMembers = () => {
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

  const { data: members, isLoading } = useQuery({
    queryKey: ["business-members", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data: rows } = await supabase
        .from("org_members")
        .select("id, user_id, role, created_at")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: true });
      if (!rows?.length) return [];
      const userIds = rows.map((r) => r.user_id);
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name, phone")
        .in("user_id", userIds);
      const byId = new Map(profs?.map((p) => [p.user_id, p]) || []);
      return rows.map((r) => ({
        ...r,
        profile: byId.get(r.user_id),
      }));
    },
    enabled: !!orgId,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users className="h-6 w-6 text-primary" />
          Team members
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          People who can book rides on your organization account.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All members</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : !members?.length ? (
            <EmptyState
              icon={Users}
              title="No members yet"
              description="Contact support to add team members to your organization."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">
                      {m.profile?.full_name || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {m.profile?.phone || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {m.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(m.created_at).toLocaleDateString()}
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

export default BusinessMembers;
