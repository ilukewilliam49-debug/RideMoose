import { Outlet } from "react-router-dom";
import logoImg from "@/assets/logo.png";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import NotificationBell from "@/components/NotificationBell";
import RoleSwitcher from "@/components/RoleSwitcher";
import { useAuth } from "@/hooks/useAuth";
import { useActiveRole } from "@/contexts/ActiveRoleContext";
import BottomTabBar from "@/components/BottomTabBar";
import DriverBottomTabBar from "@/components/DriverBottomTabBar";

const RoleLayout = () => {
  const { profile, isAdmin } = useAuth();
  const { activeRole } = useActiveRole();
  const isRider = activeRole === "rider";
  const isDriver = activeRole === "driver" && !!profile?.is_driver;
  const isBusiness = activeRole === "business" && !!profile?.is_business;
  const hasMobileNav = isRider || isDriver;

  const headerLabel = isAdmin
    ? "Admin dashboard"
    : isDriver
    ? "Driver dashboard"
    : isBusiness
    ? "Business dashboard"
    : "Rider dashboard";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        {/* Sidebar — hidden on mobile for riders and drivers */}
        <div className={hasMobileNav ? "hidden md:block" : ""}>
          <AppSidebar />
        </div>
        <div className="flex-1 flex flex-col min-w-0">
          <header className={`h-14 flex items-center border-b border-border px-4 shrink-0 safe-top ${hasMobileNav ? "md:flex" : "flex"}`}>
            <div className={hasMobileNav ? "hidden md:block" : ""}>
              <SidebarTrigger className="mr-4" />
            </div>
            {hasMobileNav && (
              <img src={logoImg} alt="PickYou" className="h-6 object-contain md:hidden" />
            )}
            <span className={`text-sm font-semibold ${hasMobileNav ? "hidden md:inline" : ""}`}>
              {headerLabel}
            </span>
            <div className="ml-auto flex items-center gap-2">
              <RoleSwitcher />
              <NotificationBell />
            </div>
          </header>
          <main className={`flex-1 p-4 md:p-6 overflow-auto ${hasMobileNav ? "pb-20 md:pb-6" : ""}`}>
            <div className="max-w-5xl mx-auto">
              <Outlet />
            </div>
          </main>
        </div>
      </div>

      {isRider && <BottomTabBar />}
      {isDriver && <DriverBottomTabBar />}
    </SidebarProvider>
  );
};

export default RoleLayout;
