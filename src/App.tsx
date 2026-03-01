import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import Login from "./pages/Login";
import ProtectedRoute from "./components/ProtectedRoute";
import RoleLayout from "./components/RoleLayout";
import AdminDashboard from "./pages/AdminDashboard";
import AdminVerifications from "./pages/AdminVerifications";
import AdminReports from "./pages/AdminReports";
import AdminUsers from "./pages/AdminUsers";
import AdminPricing from "./pages/AdminPricing";
import AdminZones from "./pages/AdminZones";
import AdminCorporate from "./pages/AdminCorporate";
import AdminSupport from "./pages/AdminSupport";
import DriverDashboard from "./pages/DriverDashboard";
import DriverDispatch from "./pages/DriverDispatch";
import DashboardHome from "./pages/DashboardHome";
import RiderDashboard from "./pages/RiderDashboard";
import CorporateApply from "./pages/CorporateApply";
import FoodRestaurants from "./pages/FoodRestaurants";
import FoodMenu from "./pages/FoodMenu";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<Login />} />
          <Route path="/auth" element={<Navigate to="/login" replace />} />

          <Route path="/admin" element={<ProtectedRoute allowedRoles={["admin"]}><RoleLayout /></ProtectedRoute>}>
            <Route index element={<AdminDashboard />} />
            <Route path="verifications" element={<AdminVerifications />} />
            <Route path="reports" element={<AdminReports />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="pricing" element={<AdminPricing />} />
            <Route path="zones" element={<AdminZones />} />
            <Route path="corporate" element={<AdminCorporate />} />
            <Route path="support" element={<AdminSupport />} />
          </Route>

          <Route path="/driver" element={<ProtectedRoute allowedRoles={["driver"]}><RoleLayout /></ProtectedRoute>}>
            <Route index element={<DriverDashboard />} />
            <Route path="dispatch" element={<DriverDispatch />} />
          </Route>

          <Route path="/rider" element={<ProtectedRoute allowedRoles={["rider"]}><RoleLayout /></ProtectedRoute>}>
            <Route index element={<DashboardHome />} />
            <Route path="rides" element={<RiderDashboard />} />
            <Route path="food" element={<FoodRestaurants />} />
            <Route path="food/:restaurantId" element={<FoodMenu />} />
            <Route path="corporate-apply" element={<CorporateApply />} />
          </Route>

          <Route path="/dashboard/*" element={<Navigate to="/rider" replace />} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
