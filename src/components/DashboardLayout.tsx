import { useAuth } from "@/hooks/useAuth";
import { Navigate, Outlet, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Swords, LogOut, Home, Car, Shield, BarChart3 } from "lucide-react";

const DashboardLayout = () => {
  const { user, profile, loading, signOut } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse-glow w-8 h-8 rounded-full bg-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  const role = profile?.role || "rider";

  const navItems = [
    { icon: Home, label: "Dashboard", path: "/dashboard", roles: ["rider", "driver", "admin"] },
    { icon: Car, label: "My Rides", path: "/dashboard/rides", roles: ["rider"] },
    { icon: Car, label: "Dispatch", path: "/dashboard/dispatch", roles: ["driver"] },
    { icon: Shield, label: "Verifications", path: "/dashboard/verifications", roles: ["admin"] },
    { icon: BarChart3, label: "Reports", path: "/dashboard/reports", roles: ["admin"] },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="fixed top-0 w-full z-50 glass-surface h-14">
        <div className="flex items-center justify-between h-full px-4">
          <div className="flex items-center gap-2">
            <Swords className="h-5 w-5 text-primary" />
            <span className="font-bold text-gradient-crimson hidden sm:inline">OnlyKnifers</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground font-mono uppercase">{role}</span>
            <Button variant="ghost" size="icon" onClick={async () => { await signOut(); navigate("/"); }}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Bottom nav (mobile) / Side nav (desktop) */}
      <nav className="fixed bottom-0 left-0 right-0 md:top-14 md:bottom-auto md:right-auto md:w-56 glass-surface z-40 border-t md:border-t-0 md:border-r border-border md:h-[calc(100vh-3.5rem)]">
        <div className="flex md:flex-col md:p-3 md:gap-1">
          {navItems
            .filter((item) => item.roles.includes(role))
            .map((item) => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className="flex-1 md:flex-none flex flex-col md:flex-row items-center md:gap-3 py-2 md:py-2.5 md:px-3 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors text-xs md:text-sm"
              >
                <item.icon className="h-5 w-5" />
                <span className="mt-1 md:mt-0">{item.label}</span>
              </button>
            ))}
        </div>
      </nav>

      {/* Main content */}
      <main className="pt-14 pb-20 md:pb-4 md:pl-56 p-4">
        <div className="max-w-5xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
