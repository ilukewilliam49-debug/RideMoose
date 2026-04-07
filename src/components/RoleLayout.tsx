import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/hooks/useAuth";
import BottomTabBar from "@/components/BottomTabBar";

const RoleLayout = () => {
  const { profile } = useAuth();
  const isRider = profile?.role === "rider";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        {/* Sidebar — hidden on mobile for riders, visible for others */}
        <div className={isRider ? "hidden md:block" : ""}>
          <AppSidebar />
        </div>
        <div className="flex-1 flex flex-col min-w-0">
          <header className={`h-14 flex items-center border-b border-border px-4 shrink-0 ${isRider ? "md:flex" : "flex"}`}>
            {/* Hide sidebar trigger on mobile for riders */}
            <div className={isRider ? "hidden md:block" : ""}>
              <SidebarTrigger className="mr-4" />
            </div>
            {/* Rider mobile header: brand wordmark */}
            {isRider && (
              <span className="text-base font-black tracking-tight md:hidden">
                Ride<span className="text-primary">Moose</span>
              </span>
            )}
            <span className={`text-sm text-muted-foreground font-medium ${isRider ? "hidden md:inline" : ""}`}>
              Dashboard
            </span>
          </header>
          <main className={`flex-1 p-4 md:p-6 overflow-auto ${isRider ? "pb-20 md:pb-6" : ""}`}>
            <div className="max-w-5xl mx-auto">
              <Outlet />
            </div>
          </main>
        </div>
      </div>

      {/* Bottom tab bar — mobile riders only */}
      {isRider && <BottomTabBar />}
    </SidebarProvider>
  );
};

export default RoleLayout;
