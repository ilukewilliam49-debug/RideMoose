import { Home, Car, Shield, BarChart3, LogOut, Users, DollarSign, MapPinned, Building2, MessageSquare, CalendarCheck, Clock, Zap, ClipboardList, Bell, Radio, FileText, WifiOff } from "lucide-react";
import { useIsOnline } from "@/hooks/useNetworkStatus";
import logoImg from "@/assets/logo.png";
import { useQuery } from "@tanstack/react-query";
import { NavLink } from "@/components/NavLink";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useActiveRole } from "@/contexts/ActiveRoleContext";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import NotificationBell from "@/components/NotificationBell";
import PushNotificationSetup from "@/components/PushNotificationSetup";
import SupportChatDialog from "@/components/SupportChatDialog";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const navByRole = (t: (key: string) => string): Record<string, { icon: any; title: string; url: string }[]> => ({
  rider: [
    { icon: Home, title: t("nav.dashboard"), url: "/rider" },
    { icon: Car, title: t("nav.myRides"), url: "/rider/rides" },
    { icon: Building2, title: t("nav.corporate"), url: "/rider/corporate-apply" },
  ],
  driver: [
    { icon: Home, title: t("nav.dashboard"), url: "/driver" },
    { icon: Car, title: t("nav.dispatch"), url: "/driver/dispatch" },
    { icon: DollarSign, title: "Earnings", url: "/driver/earnings" },
    { icon: Users, title: "Account", url: "/driver/account" },
  ],
  admin: [
    { icon: Home, title: t("nav.dashboard"), url: "/admin" },
    { icon: Shield, title: t("nav.verifications"), url: "/admin/verifications" },
    { icon: BarChart3, title: t("nav.reports"), url: "/admin/reports" },
    { icon: Users, title: t("nav.users"), url: "/admin/users" },
    { icon: DollarSign, title: t("nav.pricing"), url: "/admin/pricing" },
    { icon: MapPinned, title: t("nav.hireZones"), url: "/admin/zones" },
    { icon: Building2, title: t("nav.corporate"), url: "/admin/corporate" },
    { icon: MessageSquare, title: "Support", url: "/admin/support" },
    { icon: CalendarCheck, title: "Bookings", url: "/admin/bookings" },
    { icon: Radio, title: "Live Map", url: "/admin/live-map" },
    { icon: Zap, title: "Simulator", url: "/admin/simulator" },
    { icon: Bell, title: "Notification Logs", url: "/admin/notifications" },
    { icon: FileText, title: "Audit Log", url: "/admin/audit-log" },
  ],
});

export function AppSidebar() {
  const { state, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const isOnline = useIsOnline();
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const { activeRole, setActiveRole, canSwitch, dbRole } = useActiveRole();
  const { t } = useTranslation();
  const role = activeRole;

  const navItems = navByRole(t)[role] || navByRole(t).rider;

  const { data: openTicketCount } = useQuery({
    queryKey: ["open-support-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("support_conversations")
        .select("id", { count: "exact", head: true })
        .in("status", ["open", "in_progress"]);
      if (error) return 0;
      return count || 0;
    },
    enabled: role === "admin",
    refetchInterval: 30000,
  });

  const { data: pendingAppCount } = useQuery({
    queryKey: ["pending-corp-app-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("organization_applications")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      if (error) return 0;
      return count || 0;
    },
    enabled: role === "admin",
    refetchInterval: 30000,
  });

  const initials = profile?.full_name
    ? profile.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  // Rider stats for overview in sidebar
  const { data: rideStats } = useQuery({
    queryKey: ["rider-stats-sidebar", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;
      const { data, error } = await supabase
        .from("rides")
        .select("id, final_fare_cents, created_at, started_at, status")
        .eq("rider_id", profile.id)
        .eq("status", "completed");
      if (error) throw error;
      const count = data?.length ?? 0;
      const totalCents = data?.reduce((sum, r) => sum + (r.final_fare_cents ?? 0), 0) ?? 0;
      const waits = data
        ?.filter((r) => r.created_at && r.started_at)
        .map((r) => (new Date(r.started_at!).getTime() - new Date(r.created_at).getTime()) / 60000) ?? [];
      const avgWaitMin = waits.length > 0 ? waits.reduce((a, b) => a + b, 0) / waits.length : null;
      return { count, totalCents, avgWaitMin };
    },
    enabled: !!profile?.id && role === "rider",
  });

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarContent>
        <div className="flex items-center justify-between px-4 py-4">
          <img src={logoImg} alt="PickYou" className="h-7 object-contain shrink-0" />
          <div className="flex items-center gap-2">
            {!isOnline && (
              <div className="flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive">
                <WifiOff className="h-3 w-3" />
                {!collapsed && <span>Offline</span>}
              </div>
            )}
            {!collapsed && <NotificationBell />}
          </div>
        </div>

        <SidebarGroup>
          <SidebarGroupLabel>{t("nav.navigation")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === `/rider` || item.url === `/driver` || item.url === `/admin`}
                      className="hover:bg-accent/50"
                      activeClassName="bg-accent text-primary font-medium"
                      onClick={() => setOpenMobile(false)}
                    >
                      <item.icon className="mr-2 h-4 w-4 shrink-0" />
                      {!collapsed && (
                        <span className="flex-1 flex items-center justify-between">
                          {item.title}
                          {item.url === "/admin/support" && !!openTicketCount && openTicketCount > 0 && (
                            <span className="ml-auto inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
                              {openTicketCount > 99 ? "99+" : openTicketCount}
                            </span>
                          )}
                          {item.url === "/admin/corporate" && !!pendingAppCount && pendingAppCount > 0 && (
                            <span className="ml-auto inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                              {pendingAppCount > 99 ? "99+" : pendingAppCount}
                            </span>
                          )}
                        </span>
                      )}
                      {collapsed && item.url === "/admin/support" && !!openTicketCount && openTicketCount > 0 && (
                        <span className="absolute -top-1 -right-1 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold">
                          {openTicketCount > 99 ? "99+" : openTicketCount}
                        </span>
                      )}
                      {collapsed && item.url === "/admin/corporate" && !!pendingAppCount && pendingAppCount > 0 && (
                        <span className="absolute -top-1 -right-1 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-bold">
                          {pendingAppCount > 99 ? "99+" : pendingAppCount}
                        </span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Rider Overview Stats */}
        {role === "rider" && !collapsed && rideStats && (
          <SidebarGroup>
            <SidebarGroupLabel>{t("dashboard.yourOverview")}</SidebarGroupLabel>
            <SidebarGroupContent>
              <div className="px-3 space-y-2">
                <div className="flex items-center justify-between rounded-xl bg-card/50 px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <Car className="h-3.5 w-3.5 text-primary/70" />
                    <span className="text-[11px] text-muted-foreground">{t("dashboard.totalRides")}</span>
                  </div>
                  <span className="text-sm font-bold font-mono">{rideStats.count}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-card/50 px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-3.5 w-3.5 text-primary/70" />
                    <span className="text-[11px] text-muted-foreground">{t("dashboard.totalSpent")}</span>
                  </div>
                  <span className="text-sm font-bold font-mono">${(rideStats.totalCents / 100).toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-card/50 px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-primary/70" />
                    <span className="text-[11px] text-muted-foreground">{t("dashboard.avgWait")}</span>
                  </div>
                  <span className="text-sm font-bold font-mono">
                    {rideStats.avgWaitMin != null ? `${Math.round(rideStats.avgWaitMin)} min` : "—"}
                  </span>
                </div>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-3 space-y-2">
        {/* Role switch button */}
        {canSwitch && !collapsed && (
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-1.5"
            onClick={() => {
              const newRole = activeRole === "driver" ? "rider" : "driver";
              setActiveRole(newRole as any);
              navigate(newRole === "rider" ? "/rider" : "/driver");
              setOpenMobile(false);
            }}
          >
            <Car className="h-4 w-4 shrink-0" />
            {activeRole === "driver" ? "Switch to Rider" : "Switch to Driver"}
          </Button>
        )}
        {role === "rider" && (
          <SupportChatDialog
            trigger={
              <Button variant="outline" size="sm" className={`w-full gap-1.5 ${collapsed ? "px-0" : ""}`}>
                <MessageSquare className="h-4 w-4 shrink-0" />
                {!collapsed && <span>Support</span>}
              </Button>
            }
          />
        )}
        <PushNotificationSetup />
        <LanguageSwitcher collapsed={collapsed} />
        <div className={`flex items-center ${collapsed ? "justify-center" : "gap-3"}`}>
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="bg-primary/20 text-primary text-xs">
              {initials}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{profile?.full_name || "User"}</p>
              <p className="text-xs text-muted-foreground capitalize">{role}</p>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 h-8 w-8"
            onClick={async () => {
              localStorage.removeItem("pickyou-active-role");
              await signOut();
              navigate("/login");
            }}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
