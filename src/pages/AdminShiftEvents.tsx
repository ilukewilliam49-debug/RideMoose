import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceStrict } from "date-fns";
import { CalendarIcon, Search, Clock, AlertTriangle, Power, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { DriverShiftDetailDrawer } from "@/components/admin/DriverShiftDetailDrawer";

const PAGE_SIZE = 25;

const EVENT_OPTIONS = [
  { value: "all", label: "All events" },
  { value: "online", label: "Online" },
  { value: "offline", label: "Offline (manual)" },
  { value: "auto_capped", label: "Auto-capped (12h)" },
];

const SOURCE_OPTIONS = [
  { value: "all", label: "All sources" },
  { value: "driver_app", label: "Driver app" },
  { value: "client_cap", label: "Client cap watcher" },
  { value: "system_reaper", label: "System reaper" },
];

type ShiftEventRow = {
  id: string;
  driver_id: string;
  event_type: "online" | "offline" | "auto_capped";
  shift_session_id: string | null;
  shift_started_at: string | null;
  shift_duration_minutes: number | null;
  source: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  profiles?: { full_name: string | null; phone: string | null } | null;
};

function eventBadge(event: string) {
  if (event === "auto_capped") {
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertTriangle className="h-3 w-3" />
        Auto-capped
      </Badge>
    );
  }
  if (event === "online") {
    return (
      <Badge className="gap-1 bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/20 border-emerald-500/30">
        <PlayCircle className="h-3 w-3" />
        Online
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1">
      <Power className="h-3 w-3" />
      Offline
    </Badge>
  );
}

function formatDuration(min: number | null) {
  if (min == null) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

export default function AdminShiftEvents() {
  const [page, setPage] = useState(0);
  const [eventFilter, setEventFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  const { data, isLoading } = useQuery({
    queryKey: [
      "admin-shift-events",
      page,
      eventFilter,
      sourceFilter,
      searchTerm,
      dateFrom,
      dateTo,
    ],
    queryFn: async () => {
      let query = supabase
        .from("driver_shift_events" as any)
        .select(
          "*, profiles!driver_shift_events_driver_id_fkey(full_name, phone)",
          { count: "exact" }
        )
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (eventFilter !== "all") query = query.eq("event_type", eventFilter);
      if (sourceFilter !== "all") query = query.eq("source", sourceFilter);
      if (dateFrom) query = query.gte("created_at", dateFrom.toISOString());
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        query = query.lte("created_at", end.toISOString());
      }

      const { data, count, error } = await query;
      if (error) throw error;

      let rows = (data ?? []) as unknown as ShiftEventRow[];
      if (searchTerm) {
        const needle = searchTerm.toLowerCase();
        rows = rows.filter(
          (r) =>
            r.profiles?.full_name?.toLowerCase().includes(needle) ||
            r.profiles?.phone?.toLowerCase().includes(needle) ||
            r.driver_id.toLowerCase().includes(needle)
        );
      }
      return { rows, total: count ?? 0 };
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["admin-shift-events-stats", dateFrom, dateTo],
    queryFn: async () => {
      const since = dateFrom
        ? dateFrom.toISOString()
        : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("driver_shift_events" as any)
        .select("event_type")
        .gte("created_at", since);
      if (error) throw error;
      const arr = ((data ?? []) as unknown) as { event_type: string }[];
      return {
        online: arr.filter((r) => r.event_type === "online").length,
        offline: arr.filter((r) => r.event_type === "offline").length,
        auto_capped: arr.filter((r) => r.event_type === "auto_capped").length,
      };
    },
  });

  const totalPages = Math.ceil((data?.total ?? 0) / PAGE_SIZE);

  const resetFilters = () => {
    setEventFilter("all");
    setSourceFilter("all");
    setSearchTerm("");
    setDateFrom(undefined);
    setDateTo(undefined);
    setPage(0);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Clock className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Driver Shift Events</h1>
        {data && (
          <Badge variant="outline" className="ml-2">
            {data.total} entries
          </Badge>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Online (range)</p>
          <p className="text-2xl font-semibold mt-1">{stats?.online ?? "—"}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Manual offline (range)</p>
          <p className="text-2xl font-semibold mt-1">{stats?.offline ?? "—"}</p>
        </div>
        <div className="rounded-lg border bg-destructive/10 p-4">
          <p className="text-xs text-destructive">Auto-capped @ 12h (range)</p>
          <p className="text-2xl font-semibold mt-1 text-destructive">
            {stats?.auto_capped ?? "—"}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-44">
          <label className="text-xs text-muted-foreground mb-1 block">Event</label>
          <Select
            value={eventFilter}
            onValueChange={(v) => {
              setEventFilter(v);
              setPage(0);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EVENT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-44">
          <label className="text-xs text-muted-foreground mb-1 block">Source</label>
          <Select
            value={sourceFilter}
            onValueChange={(v) => {
              setSourceFilter(v);
              setPage(0);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SOURCE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-56">
          <label className="text-xs text-muted-foreground mb-1 block">
            Driver search
          </label>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="name, phone, id…"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(0);
              }}
              className="pl-8"
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">From</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-36 justify-start text-left font-normal",
                  !dateFrom && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateFrom ? format(dateFrom, "PP") : "Start"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateFrom}
                onSelect={(d) => {
                  setDateFrom(d);
                  setPage(0);
                }}
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">To</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-36 justify-start text-left font-normal",
                  !dateTo && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateTo ? format(dateTo, "PP") : "End"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateTo}
                onSelect={(d) => {
                  setDateTo(d);
                  setPage(0);
                }}
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>

        <Button variant="ghost" size="sm" onClick={resetFilters}>
          Clear
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Driver</TableHead>
              <TableHead>Event</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Shift started</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : data?.rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-muted-foreground py-8"
                >
                  No shift events match these filters.
                </TableCell>
              </TableRow>
            ) : (
              data?.rows.map((row) => {
                const meta = (row.metadata ?? {}) as Record<string, unknown>;
                const note =
                  row.event_type === "auto_capped"
                    ? `12h cap reached (${meta.reason ?? "hos"})`
                    : typeof meta.note === "string"
                    ? meta.note
                    : "";
                return (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      <div>{format(new Date(row.created_at), "PP p")}</div>
                      <div className="text-muted-foreground">
                        {formatDistanceStrict(
                          new Date(row.created_at),
                          new Date(),
                          { addSuffix: true }
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="font-medium">
                        {row.profiles?.full_name || "Unknown driver"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {row.profiles?.phone || row.driver_id.slice(0, 8) + "…"}
                      </div>
                    </TableCell>
                    <TableCell>{eventBadge(row.event_type)}</TableCell>
                    <TableCell className="text-xs capitalize">
                      {row.source.replace(/_/g, " ")}
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {row.shift_started_at
                        ? format(new Date(row.shift_started_at), "PP p")
                        : "—"}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-xs whitespace-nowrap",
                        row.event_type === "auto_capped" &&
                          "text-destructive font-medium"
                      )}
                    >
                      {formatDuration(row.shift_duration_minutes)}
                    </TableCell>
                    <TableCell
                      className="text-xs max-w-[220px] truncate"
                      title={note || JSON.stringify(meta)}
                    >
                      {note || (Object.keys(meta).length ? JSON.stringify(meta) : "—")}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page + 1} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
