import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import {
  User,
  Car,
  Shield,
  Phone,
  CheckCircle2,
  AlertTriangle,
  Clock,
  LogOut,
  ChevronRight,
  Briefcase,
  Package,
  Bus,
  PawPrint,
  UtensilsCrossed,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const DriverAccount = () => {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  // Verification status
  const { data: verifications } = useQuery({
    queryKey: ["driver-verifications", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data, error } = await supabase
        .from("verifications")
        .select("document_type, status")
        .eq("driver_id", profile.id);
      if (error) return [];
      return data;
    },
    enabled: !!profile?.id,
  });

  // Shift stats
  const { data: shiftStats } = useQuery({
    queryKey: ["driver-shift-stats", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;
      const { data, error } = await supabase
        .from("shift_sessions")
        .select("started_at, ended_at")
        .eq("driver_id", profile.id)
        .order("started_at", { ascending: false })
        .limit(100);
      if (error) return null;
      const completed = (data || []).filter((s) => s.ended_at);
      const totalMs = completed.reduce((sum, s) => {
        return sum + (new Date(s.ended_at!).getTime() - new Date(s.started_at).getTime());
      }, 0);
      const totalHours = Math.round(totalMs / 3600000);
      return { totalSessions: completed.length, totalHours };
    },
    enabled: !!profile?.id,
  });

  const initials = profile?.full_name
    ? profile.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "D";

  const approvedCount = verifications?.filter((v) => v.status === "approved").length ?? 0;
  const pendingCount = verifications?.filter((v) => v.status === "pending").length ?? 0;
  const totalDocs = verifications?.length ?? 0;

  const services = [
    { key: "can_taxi", label: "Taxi", icon: Car, enabled: profile?.can_taxi },
    { key: "can_private_hire", label: "Private Hire", icon: Briefcase, enabled: profile?.can_private_hire },
    { key: "can_shuttle", label: "Shuttle", icon: Bus, enabled: profile?.can_shuttle },
    { key: "can_courier", label: "Courier", icon: Package, enabled: profile?.can_courier },
    { key: "can_food_delivery", label: "Food Delivery", icon: UtensilsCrossed, enabled: profile?.can_food_delivery },
    { key: "pet_approved", label: "Pet Transport", icon: PawPrint, enabled: profile?.pet_approved },
  ].filter((s) => s.enabled);

  const commissionRate = profile?.commission_rate
    ? (Number(profile.commission_rate) * 100).toFixed(1)
    : "4.9";

  return (
    <div className="space-y-4 pb-6">
      {/* Header */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Account
        </p>
        <h1 className="text-xl font-bold tracking-tight">Your profile</h1>
      </div>

      {/* Profile card */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl bg-card ring-1 ring-border/50 p-4"
      >
        <div className="flex items-center gap-3">
          <Avatar className="h-14 w-14">
            <AvatarFallback className="bg-primary/10 text-primary text-lg font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-lg font-bold truncate">{profile?.full_name || "Driver"}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                Driver
              </span>
              {profile?.is_available ? (
                <span className="flex items-center gap-1 text-[10px] font-semibold text-green-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                  Online
                </span>
              ) : (
                <span className="text-[10px] text-muted-foreground">Offline</span>
              )}
            </div>
          </div>
        </div>

        {/* Phone */}
        {profile?.phone && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
            <Phone className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{profile.phone}</span>
            {profile.phone_verified && (
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
            )}
          </div>
        )}
      </motion.div>

      {/* Vehicle info */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="rounded-2xl bg-card ring-1 ring-border/50 p-4 space-y-3"
      >
        <div className="flex items-center gap-2">
          <Car className="h-4 w-4 text-primary" />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Vehicle
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <InfoRow label="Type" value={profile?.vehicle_type || "Not set"} />
          <InfoRow label="Seats" value={profile?.seat_capacity ? String(profile.seat_capacity) : "—"} />
          <InfoRow label="Commission" value={`${commissionRate}%`} />
          <InfoRow
            label="Balance"
            value={`$${((profile?.driver_balance_cents ?? 0) / 100).toFixed(2)}`}
          />
        </div>
      </motion.div>

      {/* Services */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-2xl bg-card ring-1 ring-border/50 p-4 space-y-3"
      >
        <div className="flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-primary" />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Enabled services
          </span>
        </div>
        {services.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {services.map((s) => (
              <span
                key={s.key}
                className="flex items-center gap-1.5 rounded-full bg-secondary ring-1 ring-border/50 px-3 py-1.5 text-xs font-medium text-secondary-foreground"
              >
                <s.icon className="h-3 w-3" />
                {s.label}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No services enabled yet. Contact admin.</p>
        )}
      </motion.div>

      {/* Verification status */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="rounded-2xl bg-card ring-1 ring-border/50 p-4 space-y-3"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Verification
            </span>
          </div>
          {totalDocs > 0 && (
            <span className="text-[10px] text-muted-foreground">
              {approvedCount}/{totalDocs} approved
            </span>
          )}
        </div>

        {totalDocs === 0 ? (
          <div className="flex items-start gap-2.5 rounded-xl bg-amber-500/5 ring-1 ring-amber-500/20 px-3 py-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">No documents uploaded</p>
              <p className="text-[10px] text-muted-foreground">
                Upload your license and vehicle documents to get verified.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {verifications?.map((v, i) => (
              <div key={i} className="flex items-center justify-between rounded-xl bg-secondary/50 px-3 py-2">
                <span className="text-xs font-medium capitalize">
                  {v.document_type.replace(/_/g, " ")}
                </span>
                <VerificationBadge status={v.status} />
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Shift stats */}
      {shiftStats && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl bg-card ring-1 ring-border/50 p-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-primary" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Activity
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <InfoRow label="Total shifts" value={String(shiftStats.totalSessions)} />
            <InfoRow label="Hours online" value={`${shiftStats.totalHours}h`} />
          </div>
        </motion.div>
      )}

      {/* Sign out */}
      <Button
        variant="outline"
        className="w-full h-12 rounded-xl gap-2 active:scale-[0.98] transition-transform"
        onClick={async () => {
          await signOut();
          navigate("/login");
        }}
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </Button>
    </div>
  );
};

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

function VerificationBadge({ status }: { status: string }) {
  if (status === "approved") {
    return (
      <span className="flex items-center gap-1 text-[10px] font-semibold text-green-500">
        <CheckCircle2 className="h-3 w-3" /> Approved
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-500">
        <Clock className="h-3 w-3" /> Pending
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-[10px] font-semibold text-destructive">
      <AlertTriangle className="h-3 w-3" /> Rejected
    </span>
  );
}

export default DriverAccount;
