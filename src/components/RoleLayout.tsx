import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/hooks/useAuth";
import BottomTabBar from "@/components/BottomTabBar";
import DriverBottomTabBar from "@/components/DriverBottomTabBar";

const RoleLayout = () => {
  const { profile } = useAuth();
  const isRider = profile?.role === "rider";
  const isDriver = profile?.role === "driver";
  const hasMobileNav = isRider || isDriver;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        {/* Sidebar — hidden on mobile for riders and drivers */}
        <div className={hasMobileNav ? "hidden md:block" : ""}>
          <AppSidebar />
        </div>
        <div className="flex-1 flex flex-col min-w-0">
          <header className={`h-14 flex items-center border-b border-border px-4 shrink-0 ${hasMobileNav ? "md:flex" : "flex"}`}>
            <div className={hasMobileNav ? "hidden md:block" : ""}>
              <SidebarTrigger className="mr-4" />
            </div>
            {hasMobileNav && (
              <span className="text-lg font-black tracking-tight md:hidden">
                Pick<span className="text-primary">You</span>
              </span>
            )}
            <span className={`text-sm text-muted-foreground font-medium ${hasMobileNav ? "hidden md:inline" : ""}`}>
              Dashboard
            </span>
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
