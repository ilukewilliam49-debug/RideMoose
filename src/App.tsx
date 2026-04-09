import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import Login from "./pages/Login";
import ProtectedRoute from "./components/ProtectedRoute";
import RoleLayout from "./components/RoleLayout";
import SessionExpiredDialog from "./components/SessionExpiredDialog";
import AdminDashboard from "./pages/AdminDashboard";
import AdminVerifications from "./pages/AdminVerifications";
import AdminReports from "./pages/AdminReports";
import AdminUsers from "./pages/AdminUsers";
import AdminUserDetail from "./pages/AdminUserDetail";
import AdminPricing from "./pages/AdminPricing";
import AdminZones from "./pages/AdminZones";
import AdminCorporate from "./pages/AdminCorporate";
import AdminSupport from "./pages/AdminSupport";
import AdminBookings from "./pages/AdminBookings";
import AdminRideDetail from "./pages/AdminRideDetail";
import AdminSimulator from "./pages/AdminSimulator";
import DriverDashboard from "./pages/DriverDashboard";
import DriverDispatch from "./pages/DriverDispatch";
import DriverEarnings from "./pages/DriverEarnings";
import DriverAccount from "./pages/DriverAccount";
import DriverOnboarding from "./pages/DriverOnboarding";
import DriverOnboardingPending from "./pages/DriverOnboardingPending";
import DashboardHome from "./pages/DashboardHome";
import RiderDashboard from "./pages/RiderDashboard";
import CourierBooking from "./pages/CourierBooking";
import CorporateApply from "./pages/CorporateApply";
import RiderActivity from "./pages/RiderActivity";
import RiderAccount from "./pages/RiderAccount";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import TermsOfService from "./pages/TermsOfService";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import { useAuth } from "./hooks/useAuth";
import ErrorBoundary from "./components/ErrorBoundary";

const queryClient = new QueryClient();

const AppContent = () => {
  const { sessionExpired, expiredEmail, clearSessionExpired } = useAuth();

  const handleReLoginSuccess = () => {
    clearSessionExpired();
    window.location.reload();
  };

  const handleSwitchAccount = () => {
    clearSessionExpired();
    window.location.href = "/login";
  };

  return (
    <>
      <SessionExpiredDialog
        open={sessionExpired}
        email={expiredEmail}
        onSuccess={handleReLoginSuccess}
        onSwitchAccount={handleSwitchAccount}
      />
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/auth" element={<Navigate to="/login" replace />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />

        <Route path="/admin" element={<ProtectedRoute allowedRoles={["admin"]}><RoleLayout /></ProtectedRoute>}>
          <Route index element={<AdminDashboard />} />
          <Route path="verifications" element={<AdminVerifications />} />
          <Route path="reports" element={<AdminReports />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="users/:id" element={<AdminUserDetail />} />
          <Route path="pricing" element={<AdminPricing />} />
          <Route path="zones" element={<AdminZones />} />
          <Route path="rides/:id" element={<AdminRideDetail />} />
          <Route path="corporate" element={<AdminCorporate />} />
          <Route path="bookings" element={<AdminBookings />} />
          <Route path="support" element={<AdminSupport />} />
          
          <Route path="simulator" element={<AdminSimulator />} />
        </Route>

        <Route path="/driver" element={<ProtectedRoute allowedRoles={["driver"]}><RoleLayout /></ProtectedRoute>}>
          <Route index element={<DriverDashboard />} />
          <Route path="dispatch" element={<DriverDispatch />} />
          <Route path="earnings" element={<DriverEarnings />} />
          <Route path="account" element={<DriverAccount />} />
        </Route>
        <Route path="/driver/onboarding" element={<ProtectedRoute allowedRoles={["driver"]}><DriverOnboarding /></ProtectedRoute>} />
        <Route path="/driver/onboarding/pending" element={<ProtectedRoute allowedRoles={["driver"]}><DriverOnboardingPending /></ProtectedRoute>} />

        <Route path="/rider" element={<ProtectedRoute allowedRoles={["rider"]}><RoleLayout /></ProtectedRoute>}>
          <Route index element={<DashboardHome />} />
          <Route path="rides" element={<RiderDashboard />} />
          <Route path="courier" element={<CourierBooking />} />
          <Route path="activity" element={<RiderActivity />} />
          <Route path="account" element={<RiderAccount />} />
          <Route path="corporate-apply" element={<CorporateApply />} />
        </Route>

        <Route path="/dashboard/*" element={<Navigate to="/rider" replace />} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
};

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
