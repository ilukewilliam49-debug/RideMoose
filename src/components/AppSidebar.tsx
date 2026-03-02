import { Home, Car, Shield, BarChart3, LogOut, Users, DollarSign, MapPinned, Building2, MessageSquare, UtensilsCrossed, CalendarCheck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import logoImg from "@/assets/logo.png";
import { NavLink } from "@/components/NavLink";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
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
    { icon: UtensilsCrossed, title: t("nav.foodDelivery"), url: "/rider/food" },
    { icon: Building2, title: t("nav.corporate"), url: "/rider/corporate-apply" },
  ],
  driver: [
    { icon: Home, title: t("nav.dashboard"), url: "/driver" },
    { icon: Car, title: t("nav.dispatch"), url: "/driver/dispatch" },
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
  ],
});

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const { t } = useTranslation();
  const role = profile?.role || "rider";

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

  const initials = profile?.full_name
    ? profile.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarContent>
        <div className="flex items-center justify-between px-4 py-4">
          <img src={logoImg} alt="OnlyKnifers" className="h-8 shrink-0 rounded" />
          {!collapsed && <NotificationBell />}
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
                        </span>
                      )}
                      {collapsed && item.url === "/admin/support" && !!openTicketCount && openTicketCount > 0 && (
                        <span className="absolute -top-1 -right-1 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold">
                          {openTicketCount > 99 ? "99+" : openTicketCount}
                        </span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 space-y-2">
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
