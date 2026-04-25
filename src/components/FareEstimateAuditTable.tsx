import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export interface FareEstimateAuditRow {
  id: string;
  created_at: string;
  event_type: string;
  service_type: string | null;
  pickup_address: string | null;
  dropoff_address: string | null;
  stop_count: number;
  distance_km: number | null;
  estimated_fare_cents: number | null;
  fare_inputs_key: string;
  metadata: Record<string, unknown> | null;
  rider_profile_id?: string;
  profiles?: { full_name: string | null } | null;
}

interface Props {
  rows: FareEstimateAuditRow[] | undefined;
  isLoading?: boolean;
  showRider?: boolean;
}

const eventVariant = (event: string) =>
  event === "submit_blocked_stale" ? "destructive" : "secondary";

const eventLabel = (event: string) =>
  event === "submit_blocked_stale" ? "Submit blocked (stale)" : "Estimate changed";

const formatCents = (c: number | null) =>
  c == null ? "—" : `$${(c / 100).toFixed(2)}`;

export function FareEstimateAuditTable({ rows, isLoading, showRider }: Props) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Time</TableHead>
            {showRider && <TableHead>Rider</TableHead>}
            <TableHead>Event</TableHead>
            <TableHead>Service</TableHead>
            <TableHead>Route</TableHead>
            <TableHead className="text-right">Distance</TableHead>
            <TableHead className="text-right">Estimate</TableHead>
            <TableHead>Fare key</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: showRider ? 8 : 7 }).map((_, j) => (
                  <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                ))}
              </TableRow>
            ))
          ) : !rows || rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={showRider ? 8 : 7} className="text-center text-muted-foreground py-8">
                No fare estimate events recorded yet
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="whitespace-nowrap text-xs">
                  {format(new Date(row.created_at), "PP p")}
                </TableCell>
                {showRider && (
                  <TableCell className="text-sm">
                    {row.profiles?.full_name || "Unknown"}
                  </TableCell>
                )}
                <TableCell>
                  <Badge variant={eventVariant(row.event_type)}>
                    {eventLabel(row.event_type)}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs capitalize">
                  {row.service_type?.replace(/_/g, " ") || "—"}
                </TableCell>
                <TableCell className="text-xs max-w-[260px]">
                  <div className="truncate" title={row.pickup_address || ""}>
                    <span className="text-muted-foreground">From:</span> {row.pickup_address || "—"}
                  </div>
                  <div className="truncate" title={row.dropoff_address || ""}>
                    <span className="text-muted-foreground">To:</span> {row.dropoff_address || "—"}
                  </div>
                  {row.stop_count > 0 && (
                    <div className="text-muted-foreground">
                      +{row.stop_count} stop{row.stop_count === 1 ? "" : "s"}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-right text-xs whitespace-nowrap">
                  {row.distance_km != null ? `${Number(row.distance_km).toFixed(2)} km` : "—"}
                </TableCell>
                <TableCell className="text-right text-xs whitespace-nowrap font-medium">
                  {formatCents(row.estimated_fare_cents)}
                </TableCell>
                <TableCell
                  className="text-[10px] font-mono max-w-[220px] truncate text-muted-foreground"
                  title={row.fare_inputs_key}
                >
                  {row.fare_inputs_key}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
