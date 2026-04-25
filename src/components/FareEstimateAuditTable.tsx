import { useState } from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface FareEstimateAuditRow {
  id: string;
  created_at: string;
  event_type: string;
  service_type: string | null;
  pickup_address: string | null;
  dropoff_address: string | null;
  pickup_lat?: number | null;
  pickup_lng?: number | null;
  dropoff_lat?: number | null;
  dropoff_lng?: number | null;
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

const formatCoord = (lat?: number | null, lng?: number | null) =>
  lat != null && lng != null ? `${lat.toFixed(6)}, ${lng.toFixed(6)}` : "—";

export function FareEstimateAuditTable({ rows, isLoading, showRider }: Props) {
  const [selected, setSelected] = useState<FareEstimateAuditRow | null>(null);

  return (
    <>
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
                <TableRow
                  key={row.id}
                  onClick={() => setSelected(row)}
                  className="cursor-pointer hover:bg-muted/50"
                  title="Click to view full metadata"
                >
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

      <FareEstimateAuditDetailDialog
        row={selected}
        onOpenChange={(open) => !open && setSelected(null)}
        showRider={showRider}
      />
    </>
  );
}

interface DetailProps {
  row: FareEstimateAuditRow | null;
  onOpenChange: (open: boolean) => void;
  showRider?: boolean;
}

function FareEstimateAuditDetailDialog({ row, onOpenChange, showRider }: DetailProps) {
  if (!row) return null;

  const metadata = (row.metadata ?? {}) as Record<string, unknown>;
  const previousKey = typeof metadata.previous_fare_inputs_key === "string"
    ? metadata.previous_fare_inputs_key
    : metadata.previous_fare_inputs_key === null
      ? "(none — first entry)"
      : null;
  const reason = typeof metadata.reason === "string" ? metadata.reason : null;

  // Strip already-displayed keys from the raw metadata dump to avoid duplication
  const otherMetadata = Object.fromEntries(
    Object.entries(metadata).filter(
      ([k]) => k !== "previous_fare_inputs_key" && k !== "reason"
    )
  );

  return (
    <Dialog open={!!row} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Badge variant={eventVariant(row.event_type)}>
              {eventLabel(row.event_type)}
            </Badge>
            <span className="text-base">Audit detail</span>
          </DialogTitle>
          <DialogDescription>
            {format(new Date(row.created_at), "PPpp")}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[65vh] pr-3">
          <div className="space-y-4 text-sm">
            {showRider && (
              <DetailField label="Rider" value={row.profiles?.full_name || "Unknown"} />
            )}
            <DetailField
              label="Service"
              value={row.service_type?.replace(/_/g, " ") || "—"}
              capitalize
            />

            {row.event_type === "submit_blocked_stale" && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 space-y-1">
                <div className="text-xs font-semibold text-destructive uppercase tracking-wide">
                  Stale submission blocked
                </div>
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Reason:</span>{" "}
                  {reason || "estimate_out_of_sync"}
                </div>
                <div className="text-xs text-muted-foreground">
                  The fare estimate fingerprint had changed but the new price was
                  still being computed when the rider tried to submit. The
                  request was rejected to prevent charging a stale subtotal.
                </div>
              </div>
            )}

            <Separator />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <DetailField label="Pickup address" value={row.pickup_address || "—"} multiline />
              <DetailField label="Dropoff address" value={row.dropoff_address || "—"} multiline />
              <DetailField
                label="Pickup coordinates"
                value={formatCoord(row.pickup_lat, row.pickup_lng)}
                mono
              />
              <DetailField
                label="Dropoff coordinates"
                value={formatCoord(row.dropoff_lat, row.dropoff_lng)}
                mono
              />
              <DetailField
                label="Distance"
                value={row.distance_km != null ? `${Number(row.distance_km).toFixed(2)} km` : "—"}
              />
              <DetailField label="Stops" value={String(row.stop_count)} />
              <DetailField
                label="Estimated fare"
                value={formatCents(row.estimated_fare_cents)}
                strong
              />
            </div>

            <Separator />

            <DetailField
              label="Current fare inputs key"
              value={row.fare_inputs_key}
              mono
              wrap
            />
            <DetailField
              label="Previous fare inputs key"
              value={previousKey ?? "—"}
              mono
              wrap
            />

            {Object.keys(otherMetadata).length > 0 && (
              <>
                <Separator />
                <div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                    Additional metadata
                  </div>
                  <pre className="text-[11px] font-mono bg-muted rounded-md p-3 whitespace-pre-wrap break-all">
                    {JSON.stringify(otherMetadata, null, 2)}
                  </pre>
                </div>
              </>
            )}

            <div className="text-[10px] text-muted-foreground">
              Audit ID: <span className="font-mono">{row.id}</span>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

interface DetailFieldProps {
  label: string;
  value: string;
  mono?: boolean;
  wrap?: boolean;
  multiline?: boolean;
  strong?: boolean;
  capitalize?: boolean;
}

function DetailField({ label, value, mono, wrap, multiline, strong, capitalize }: DetailFieldProps) {
  return (
    <div>
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">
        {label}
      </div>
      <div
        className={[
          mono ? "font-mono text-xs" : "text-sm",
          wrap ? "break-all" : "",
          multiline ? "" : "truncate",
          strong ? "font-semibold" : "",
          capitalize ? "capitalize" : "",
        ].filter(Boolean).join(" ")}
        title={value}
      >
        {value}
      </div>
    </div>
  );
}
