import { Home, Car, Shield, BarChart3, LogOut, Users, DollarSign, MapPinned, Building2 } from "lucide-react";
import logoImg from "@/assets/logo.png";
import { NavLink } from "@/components/NavLink";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
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

const navByRole: Record<string, { icon: any; title: string; url: string }[]> = {
  rider: [
    { icon: Home, title: "Dashboard", url: "/rider" },
    { icon: Car, title: "My Rides", url: "/rider/rides" },
    { icon: Building2, title: "Corporate", url: "/rider/corporate-apply" },
  ],
  driver: [
    { icon: Home, title: "Dashboard", url: "/driver" },
    { icon: Car, title: "Dispatch", url: "/driver/dispatch" },
  ],
  admin: [
    { icon: Home, title: "Dashboard", url: "/admin" },
    { icon: Shield, title: "Verifications", url: "/admin/verifications" },
    { icon: BarChart3, title: "Reports", url: "/admin/reports" },
    { icon: Users, title: "Users", url: "/admin/users" },
    { icon: DollarSign, title: "Pricing", url: "/admin/pricing" },
    { icon: MapPinned, title: "Hire Zones", url: "/admin/zones" },
    { icon: Building2, title: "Corporate", url: "/admin/corporate" },
  ],
};

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const role = profile?.role || "rider";

  const navItems = navByRole[role] || navByRole.rider;
  const initials = profile?.full_name
    ? profile.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarContent>
        <div className="flex items-center px-4 py-4">
          <img src={logoImg} alt="OnlyKnifers" className="h-8 shrink-0 rounded" />
        </div>

        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
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
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3">
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
