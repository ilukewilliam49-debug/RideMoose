import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AdminBreadcrumb from "@/components/admin/AdminBreadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import ErrorRetry from "@/components/driver/ErrorRetry";
import { format } from "date-fns";
import {
  MapPin, Clock, Car, User, DollarSign, CreditCard,
  Package, ArrowRight, CalendarDays, Ruler, Timer,
} from "lucide-react";
import { Link } from "react-router-dom";

const statusColor: Record<string, string> = {
  completed: "bg-green-500/10 text-green-500",
  in_progress: "bg-blue-500/10 text-blue-500",
  requested: "bg-yellow-500/10 text-yellow-500",
  cancelled: "bg-destructive/10 text-destructive",
  accepted: "bg-primary/10 text-primary",
  dispatched: "bg-primary/10 text-primary",
};

export default function AdminRideDetail() {
  const { id } = useParams<{ id: string }>();

  const { data: ride, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-ride-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rides")
        .select("*, rider:profiles!rides_rider_id_fkey(id, full_name, phone), driver:profiles!rides_driver_id_fkey(id, full_name, phone)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  if (isError) {
    return (
      <div className="space-y-6">
        <AdminBreadcrumb segmentLabels={{ reports: "Reports" }} pageTitle="Ride Not Found" />
        <ErrorRetry message="Failed to load ride details" onRetry={() => refetch()} />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <AdminBreadcrumb segmentLabels={{ rides: "Reports" }} pageTitle="Loading..." />
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const rider = ride?.rider as any;
  const driver = ride?.driver as any;

  return (
    <div className="space-y-6">
      <AdminBreadcrumb
        segmentLabels={{ rides: "Reports" }}
        pageTitle={`Ride ${id?.slice(0, 8)}…`}
      />

      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <Car className="h-7 w-7 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold capitalize">{ride?.service_type?.replace(/_/g, " ")}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge className={statusColor[ride?.status || ""] || ""}>{ride?.status}</Badge>
            <span className="text-sm text-muted-foreground">
              {ride?.created_at ? format(new Date(ride.created_at), "PPp") : ""}
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Route */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Route</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <MapPin className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">Pickup</p>
                <p className="text-sm text-muted-foreground">{ride?.pickup_address}</p>
                {ride?.pickup_notes && <p className="text-xs text-muted-foreground italic mt-1">{ride.pickup_notes}</p>}
              </div>
            </div>
            <div className="flex items-center justify-center">
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">Dropoff</p>
                <p className="text-sm text-muted-foreground">{ride?.dropoff_address}</p>
                {ride?.dropoff_notes && <p className="text-xs text-muted-foreground italic mt-1">{ride.dropoff_notes}</p>}
              </div>
            </div>
            {(ride?.distance_km || ride?.duration_min) && (
              <div className="flex gap-4 pt-2 border-t text-sm text-muted-foreground">
                {ride.distance_km && (
                  <span className="flex items-center gap-1"><Ruler className="h-3 w-3" />{Number(ride.distance_km).toFixed(1)} km</span>
                )}
                {ride.duration_min > 0 && (
                  <span className="flex items-center gap-1"><Timer className="h-3 w-3" />{Math.round(ride.duration_min)} min</span>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* People */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">People</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Rider</p>
                  {rider ? (
                    <Link to={`/admin/users/${rider.id}`} className="text-sm text-primary hover:underline">
                      {rider.full_name || "Unnamed"}
                    </Link>
                  ) : (
                    <p className="text-sm text-muted-foreground">—</p>
                  )}
                </div>
              </div>
              {rider?.phone && <span className="text-xs text-muted-foreground">{rider.phone}</span>}
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Car className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Driver</p>
                  {driver ? (
                    <Link to={`/admin/users/${driver.id}`} className="text-sm text-primary hover:underline">
                      {driver.full_name || "Unnamed"}
                    </Link>
                  ) : (
                    <p className="text-sm text-muted-foreground">Not assigned</p>
                  )}
                </div>
              </div>
              {driver?.phone && <span className="text-xs text-muted-foreground">{driver.phone}</span>}
            </div>
            {ride?.passenger_count > 1 && (
              <p className="text-sm text-muted-foreground">Passengers: {ride.passenger_count}</p>
            )}
            {ride?.scheduled_at && (
              <div className="flex items-center gap-2 pt-2 border-t">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Scheduled: {format(new Date(ride.scheduled_at), "PPp")}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Financials */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Financials</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row icon={DollarSign} label="Estimated" value={fmtPrice(ride?.estimated_price)} />
            <Row icon={DollarSign} label="Final Price" value={fmtPrice(ride?.final_price)} bold />
            {ride?.final_fare_cents != null && (
              <Row icon={DollarSign} label="Meter Fare" value={fmtCents(ride.final_fare_cents)} />
            )}
            <div className="border-t pt-2 space-y-2">
              <Row icon={CreditCard} label="Service Fee" value={fmtCents(ride?.service_fee_cents)} />
              <Row icon={CreditCard} label="Commission" value={fmtCents(ride?.commission_cents)} />
              <Row icon={CreditCard} label="Stripe Fee" value={fmtCents(ride?.stripe_fee_cents)} />
              <Row icon={CreditCard} label="Driver Earnings" value={fmtCents(ride?.driver_earnings_cents)} />
              {ride?.tip_cents > 0 && <Row icon={DollarSign} label="Tip" value={fmtCents(ride.tip_cents)} />}
            </div>
            <div className="border-t pt-2 space-y-1">
              <p className="text-muted-foreground">Payment: <span className="capitalize">{ride?.payment_option?.replace(/_/g, " ")}</span></p>
              <p className="text-muted-foreground">Status: <span className="capitalize">{ride?.payment_status}</span></p>
              {ride?.billed_to === "organization" && <p className="text-muted-foreground">Billed to: Organization</p>}
            </div>
          </CardContent>
        </Card>

        {/* Details */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p><span className="text-muted-foreground">Pricing model:</span> <span className="capitalize">{ride?.pricing_model}</span></p>
            <p><span className="text-muted-foreground">Meter status:</span> <span className="capitalize">{ride?.meter_status}</span></p>
            {ride?.started_at && <p><span className="text-muted-foreground">Started:</span> {format(new Date(ride.started_at), "PPp")}</p>}
            {ride?.completed_at && <p><span className="text-muted-foreground">Completed:</span> {format(new Date(ride.completed_at), "PPp")}</p>}
            {ride?.cancellation_reason && (
              <div className="pt-2 border-t">
                <p className="text-muted-foreground">Cancellation reason:</p>
                <p>{ride.cancellation_reason}</p>
                {ride.cancellation_fee_cents > 0 && <p className="text-muted-foreground">Fee: {fmtCents(ride.cancellation_fee_cents)}</p>}
              </div>
            )}
            {ride?.item_description && <p><span className="text-muted-foreground">Item:</span> {ride.item_description}</p>}
            {ride?.package_size && <p><span className="text-muted-foreground">Package:</span> {ride.package_size}</p>}
            <p className="text-xs text-muted-foreground pt-2 border-t font-mono break-all">ID: {ride?.id}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ icon: Icon, label, value, bold }: { icon: React.ElementType; label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-muted-foreground"><Icon className="h-3 w-3" />{label}</span>
      <span className={bold ? "font-semibold" : ""}>{value}</span>
    </div>
  );
}

function fmtPrice(v: number | null | undefined) {
  return v != null ? `${Number(v).toLocaleString()} ISK` : "—";
}

function fmtCents(v: number | null | undefined) {
  return v != null ? `${(v / 100).toLocaleString()} ISK` : "—";
}
