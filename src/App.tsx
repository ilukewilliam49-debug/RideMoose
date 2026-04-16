import { useState, useEffect, lazy, Suspense } from "react";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
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
import OfflineBanner from "./components/OfflineBanner";
import NetworkErrorBanner from "./components/NetworkErrorBanner";
import SplashScreen from "./components/SplashScreen";
import { useAuth } from "./hooks/useAuth";
import ErrorBoundary from "./components/ErrorBoundary";
import { ActiveRoleProvider } from "./contexts/ActiveRoleContext";

// Lazy load heavy route pages for faster initial load
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminVerifications = lazy(() => import("./pages/AdminVerifications"));
const AdminReports = lazy(() => import("./pages/AdminReports"));
const AdminUsers = lazy(() => import("./pages/AdminUsers"));
const AdminUserDetail = lazy(() => import("./pages/AdminUserDetail"));
const AdminPricing = lazy(() => import("./pages/AdminPricing"));
const AdminZones = lazy(() => import("./pages/AdminZones"));
const AdminCorporate = lazy(() => import("./pages/AdminCorporate"));
const AdminSupport = lazy(() => import("./pages/AdminSupport"));
const AdminBookings = lazy(() => import("./pages/AdminBookings"));
const AdminRideDetail = lazy(() => import("./pages/AdminRideDetail"));
const AdminSimulator = lazy(() => import("./pages/AdminSimulator"));
const AdminNotificationLogs = lazy(() => import("./pages/AdminNotificationLogs"));
const AdminLiveMap = lazy(() => import("./pages/AdminLiveMap"));
const AdminAuditLog = lazy(() => import("./pages/AdminAuditLog"));

const DriverDashboard = lazy(() => import("./pages/DriverDashboard"));
const DriverDispatch = lazy(() => import("./pages/DriverDispatch"));
const DriverEarnings = lazy(() => import("./pages/DriverEarnings"));
const DriverAccount = lazy(() => import("./pages/DriverAccount"));
const DriverOnboarding = lazy(() => import("./pages/DriverOnboarding"));
const DriverOnboardingPending = lazy(() => import("./pages/DriverOnboardingPending"));

const DashboardHome = lazy(() => import("./pages/DashboardHome"));
const RiderDashboard = lazy(() => import("./pages/RiderDashboard"));
const CourierBooking = lazy(() => import("./pages/CourierBooking"));
const CorporateApply = lazy(() => import("./pages/CorporateApply"));
const RiderActivity = lazy(() => import("./pages/RiderActivity"));
const RiderAccount = lazy(() => import("./pages/RiderAccount"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const NotFound = lazy(() => import("./pages/NotFound"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const Unsubscribe = lazy(() => import("./pages/Unsubscribe"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="animate-pulse-glow w-8 h-8 rounded-full bg-primary" />
  </div>
);

const AppContent = () => {
  const { sessionExpired, expiredEmail, clearSessionExpired } = useAuth();
  useNetworkStatus();

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
      <OfflineBanner />
      <NetworkErrorBanner />
      <SessionExpiredDialog
        open={sessionExpired}
        email={expiredEmail}
        onSuccess={handleReLoginSuccess}
        onSwitchAccount={handleSwitchAccount}
      />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/index" element={<Navigate to="/" replace />} />
          <Route path="/index.html" element={<Navigate to="/" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/auth" element={<Navigate to="/login" replace />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/corporate-apply" element={<Navigate to="/rider/corporate-apply" replace />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/unsubscribe" element={<Unsubscribe />} />

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
            <Route path="notifications" element={<AdminNotificationLogs />} />
            <Route path="live-map" element={<AdminLiveMap />} />
            <Route path="audit-log" element={<AdminAuditLog />} />
          </Route>

          <Route path="/driver" element={<ProtectedRoute allowedRoles={["driver"]}><RoleLayout /></ProtectedRoute>}>
            <Route index element={<DriverDashboard />} />
            <Route path="dispatch" element={<DriverDispatch />} />
            <Route path="earnings" element={<DriverEarnings />} />
            <Route path="account" element={<DriverAccount />} />
          </Route>
          <Route path="/driver/onboarding" element={<ProtectedRoute allowedRoles={["driver"]}><DriverOnboarding /></ProtectedRoute>} />
          <Route path="/driver/onboarding/pending" element={<ProtectedRoute allowedRoles={["driver"]}><DriverOnboardingPending /></ProtectedRoute>} />

          <Route path="/rider" element={<ProtectedRoute allowedRoles={["rider", "driver"]}><RoleLayout /></ProtectedRoute>}>
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
      </Suspense>
    </>
  );
};

const App = () => {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <SplashScreen visible={showSplash} />
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ActiveRoleProvider>
              <AppContent />
            </ActiveRoleProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
