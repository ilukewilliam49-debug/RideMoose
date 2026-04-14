import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { CalendarIcon, Search, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

const ACTION_OPTIONS = [
  { value: "all", label: "All Actions" },
  { value: "force_cancel", label: "Force Cancel" },
  { value: "force_complete", label: "Force Complete" },
  { value: "reassign_driver", label: "Reassign Driver" },
  { value: "update_profile", label: "Update Profile" },
  { value: "role_change", label: "Role Change" },
];

export default function AdminAuditLog() {
  const [page, setPage] = useState(0);
  const [actionFilter, setActionFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-audit-log", page, actionFilter, searchTerm, dateFrom, dateTo],
    queryFn: async () => {
      let query = supabase
        .from("admin_audit_log")
        .select("*, profiles!admin_audit_log_admin_profile_id_fkey(full_name)", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (actionFilter !== "all") {
        query = query.eq("action", actionFilter);
      }
      if (searchTerm) {
        query = query.or(`target_type.ilike.%${searchTerm}%,action.ilike.%${searchTerm}%`);
      }
      if (dateFrom) {
        query = query.gte("created_at", dateFrom.toISOString());
      }
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        query = query.lte("created_at", end.toISOString());
      }

      const { data, count, error } = await query;
      if (error) throw error;
      return { logs: data ?? [], total: count ?? 0 };
    },
  });

  const totalPages = Math.ceil((data?.total ?? 0) / PAGE_SIZE);

  const resetFilters = () => {
    setActionFilter("all");
    setSearchTerm("");
    setDateFrom(undefined);
    setDateTo(undefined);
    setPage(0);
  };

  const actionColor = (action: string) => {
    if (action.includes("cancel")) return "destructive";
    if (action.includes("reassign")) return "secondary";
    if (action.includes("role")) return "default";
    return "outline";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Shield className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Audit Log</h1>
        {data && <Badge variant="outline" className="ml-2">{data.total} entries</Badge>}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-48">
          <label className="text-xs text-muted-foreground mb-1 block">Action</label>
          <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(0); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {ACTION_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-56">
          <label className="text-xs text-muted-foreground mb-1 block">Search</label>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="target type, action..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
              className="pl-8"
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">From</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-36 justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateFrom ? format(dateFrom, "PP") : "Start"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateFrom} onSelect={(d) => { setDateFrom(d); setPage(0); }} className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">To</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-36 justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateTo ? format(dateTo, "PP") : "End"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateTo} onSelect={(d) => { setDateTo(d); setPage(0); }} className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
        </div>

        <Button variant="ghost" size="sm" onClick={resetFilters}>Clear</Button>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Admin</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Target ID</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : data?.logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">No audit log entries found</TableCell>
              </TableRow>
            ) : (
              data?.logs.map((log: any) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap text-xs">{format(new Date(log.created_at), "PP p")}</TableCell>
                  <TableCell className="text-sm">{log.profiles?.full_name || "Unknown"}</TableCell>
                  <TableCell><Badge variant={actionColor(log.action)}>{log.action.replace(/_/g, " ")}</Badge></TableCell>
                  <TableCell className="text-sm capitalize">{log.target_type}</TableCell>
                  <TableCell className="text-xs font-mono truncate max-w-[120px]" title={log.target_id}>{log.target_id.slice(0, 8)}…</TableCell>
                  <TableCell className="text-xs max-w-[200px] truncate" title={JSON.stringify(log.details)}>
                    {log.details ? JSON.stringify(log.details) : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Page {page + 1} of {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
