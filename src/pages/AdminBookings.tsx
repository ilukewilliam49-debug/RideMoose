import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { CalendarCheck, Search, Filter, Eye } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import ErrorRetry from "@/components/driver/ErrorRetry";

const STATUS_COLORS: Record<string, string> = {
  requested: "bg-yellow-500/15 text-yellow-700 border-yellow-500/30",
  dispatched: "bg-blue-500/15 text-blue-700 border-blue-500/30",
  accepted: "bg-indigo-500/15 text-indigo-700 border-indigo-500/30",
  in_progress: "bg-primary/15 text-primary border-primary/30",
  completed: "bg-green-500/15 text-green-700 border-green-500/30",
  cancelled: "bg-destructive/15 text-destructive border-destructive/30",
};

const PAGE_SIZE = 20;

const AdminBookings = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [page, setPage] = useState(0);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-bookings", statusFilter, serviceFilter, page],
    queryFn: async () => {
      let query = supabase
        .from("rides")
        .select(
          "id, status, service_type, pickup_address, dropoff_address, created_at, scheduled_at, estimated_price, final_price, rider_id, driver_id",
          { count: "exact" }
        )
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter as any);
      }
      if (serviceFilter !== "all") {
        query = query.eq("service_type", serviceFilter as any);
      }

      const { data: rides, count, error } = await query;
      if (error) throw error;
      return { rides: rides || [], total: count || 0 };
    },
  });

  const filtered = (data?.rides || []).filter((r) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      r.pickup_address?.toLowerCase().includes(s) ||
      r.dropoff_address?.toLowerCase().includes(s) ||
      r.id?.toLowerCase().includes(s)
    );
  });

  const totalPages = Math.ceil((data?.total || 0) / PAGE_SIZE);

  return (
    <div className="space-y-6 pt-4">
      <div className="space-y-1">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          <CalendarCheck className="h-3.5 w-3.5" />
          Bookings
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Ride Bookings</h1>
        <p className="text-sm text-muted-foreground">
          View and manage all ride bookings across the platform.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by address or booking ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
            <SelectTrigger className="w-[140px]">
              <Filter className="mr-2 h-3.5 w-3.5" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="requested">Requested</SelectItem>
              <SelectItem value="dispatched">Dispatched</SelectItem>
              <SelectItem value="accepted">Accepted</SelectItem>
              <SelectItem value="in_progress">In progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>

          <Select value={serviceFilter} onValueChange={(v) => { setServiceFilter(v); setPage(0); }}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Service" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All services</SelectItem>
              <SelectItem value="taxi">Taxi</SelectItem>
              <SelectItem value="private_hire">Private hire</SelectItem>
              <SelectItem value="shuttle">Shuttle</SelectItem>
              <SelectItem value="courier">Courier</SelectItem>
              <SelectItem value="food_delivery">Food delivery</SelectItem>
              <SelectItem value="pet_transport">Pet transport</SelectItem>
              <SelectItem value="large_delivery">Large delivery</SelectItem>
              <SelectItem value="retail_delivery">Retail delivery</SelectItem>
              <SelectItem value="personal_shopper">Personal shopper</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isError ? (
        <ErrorRetry message="Failed to load bookings" onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-border/50 bg-card/70 p-12 text-center">
          <p className="text-muted-foreground">No bookings found.</p>
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-border/50 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead className="hidden md:table-cell">Pickup</TableHead>
                  <TableHead className="hidden lg:table-cell">Dropoff</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((ride) => (
                  <TableRow
                    key={ride.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/admin/rides/${ride.id}`)}
                  >
                    <TableCell className="whitespace-nowrap text-sm">
                      {ride.scheduled_at
                        ? format(new Date(ride.scheduled_at), "dd MMM yyyy HH:mm")
                        : format(new Date(ride.created_at), "dd MMM yyyy HH:mm")}
                      {ride.scheduled_at && (
                        <span className="ml-1 text-xs text-primary font-medium">Scheduled</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize text-xs">
                        {ride.service_type.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell max-w-[180px] truncate text-sm text-muted-foreground">
                      {ride.pickup_address}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell max-w-[180px] truncate text-sm text-muted-foreground">
                      {ride.dropoff_address}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`capitalize text-xs ${STATUS_COLORS[ride.status] || ""}`}
                      >
                        {ride.status.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium tabular-nums">
                      {ride.final_price != null
                        ? `$${Number(ride.final_price).toFixed(2)}`
                        : ride.estimated_price != null
                        ? `~$${Number(ride.estimated_price).toFixed(2)}`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {page + 1} of {totalPages} · {data?.total} bookings
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AdminBookings;
