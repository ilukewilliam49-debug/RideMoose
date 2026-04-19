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
import IdleTimeoutDialog from "./components/IdleTimeoutDialog";
// Offline UX handled by the sonner toast in useNetworkStatus — duplicate
// banners removed to avoid stacking notifications and a framer-motion warning.
import SplashScreen from "./components/SplashScreen";
import { useAuth } from "./hooks/useAuth";
import { useHasActiveRide } from "./hooks/useHasActiveRide";
import ErrorBoundary from "./components/ErrorBoundary";
import { ActiveRoleProvider } from "./contexts/ActiveRoleContext";
import { RideBookingProvider } from "./contexts/RideBookingContext";
import SignupIntentRoute from "./components/SignupIntentRoute";

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
const BusinessApply = lazy(() => import("./pages/BusinessApply"));
const RiderActivity = lazy(() => import("./pages/RiderActivity"));
const RiderAccount = lazy(() => import("./pages/RiderAccount"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const NotFound = lazy(() => import("./pages/NotFound"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const Unsubscribe = lazy(() => import("./pages/Unsubscribe"));
const GuestTrack = lazy(() => import("./pages/GuestTrack"));
const GuestRate = lazy(() => import("./pages/GuestRate"));
const DriveLanding = lazy(() => import("./pages/DriveLanding"));
const BusinessLanding = lazy(() => import("./pages/BusinessLanding"));
const BusinessDashboard = lazy(() => import("./pages/BusinessDashboard"));
const BusinessMembers = lazy(() => import("./pages/BusinessMembers"));
const BusinessInvoices = lazy(() => import("./pages/BusinessInvoices"));
const BusinessRides = lazy(() => import("./pages/BusinessRides"));

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
  const { user, profile, sessionExpired, expiredEmail, clearSessionExpired, signOut } = useAuth();
  useNetworkStatus();
  const hasActiveRide = useHasActiveRide(profile);

  const handleReLoginSuccess = () => {
    clearSessionExpired();
    window.location.reload();
  };

  const handleSwitchAccount = () => {
    clearSessionExpired();
    window.location.href = "/login";
  };

  const handleIdleSignOut = async () => {
    await signOut();
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
      <IdleTimeoutDialog enabled={!!user && !hasActiveRide} onSignOut={handleIdleSignOut} />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/index" element={<Navigate to="/" replace />} />
          <Route path="/index.html" element={<Navigate to="/" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/auth" element={<Navigate to="/login" replace />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/corporate-apply" element={<Navigate to="/business/apply" replace />} />
          <Route path="/rider/corporate-apply" element={<Navigate to="/business/apply" replace />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/unsubscribe" element={<Unsubscribe />} />
          <Route path="/t/:token" element={<GuestTrack />} />
          <Route path="/t/:token/rate" element={<GuestRate />} />
          <Route path="/drive" element={<DriveLanding />} />
          <Route path="/business" element={<BusinessLanding />} />
          <Route path="/business/apply" element={<BusinessApply />} />

          {/* Signup intent shims — make role-aware signup links work from
              anywhere. They forward to /login with intent=... + returnTo, or
              for business straight to the public apply form. */}
          <Route path="/signup/rider" element={<SignupIntentRoute role="rider" />} />
          <Route path="/signup/driver" element={<SignupIntentRoute role="driver" />} />
          <Route path="/signup/business" element={<SignupIntentRoute role="business" />} />

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

          <Route path="/business" element={<ProtectedRoute allowedRoles={["business"]}><RoleLayout /></ProtectedRoute>}>
            <Route index element={<BusinessDashboard />} />
            <Route path="members" element={<BusinessMembers />} />
            <Route path="invoices" element={<BusinessInvoices />} />
            <Route path="rides" element={<BusinessRides />} />
          </Route>

          <Route path="/rider" element={<ProtectedRoute allowedRoles={["rider", "driver"]}><RoleLayout /></ProtectedRoute>}>
            <Route index element={<DashboardHome />} />
            <Route path="rides" element={<RiderDashboard />} />
            <Route path="courier" element={<CourierBooking />} />
            <Route path="activity" element={<RiderActivity />} />
            <Route path="account" element={<RiderAccount />} />
          </Route>

          <Route path="/dashboard/*" element={<Navigate to="/rider" replace />} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </>
  );
};

const SPLASH_SHOWN_KEY = "pickyou.splash_shown";

const App = () => {
  // Splash should only appear on the first load of a browser session, not on
  // every soft navigation, HMR update, or component remount that happens
  // afterwards. Persist a flag in sessionStorage so the second appearance is
  // suppressed (the rrweb session replay showed splash flashing again ~12s
  // after the first dismissal, which is what the user perceived as a glitch).
  const [showSplash, setShowSplash] = useState(() => {
    try {
      return sessionStorage.getItem(SPLASH_SHOWN_KEY) !== "1";
    } catch {
      return true;
    }
  });

  useEffect(() => {
    if (!showSplash) return;
    const timer = setTimeout(() => {
      setShowSplash(false);
      try {
        sessionStorage.setItem(SPLASH_SHOWN_KEY, "1");
      } catch {
        /* ignore storage errors */
      }
    }, 1200);
    return () => clearTimeout(timer);
  }, [showSplash]);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <SplashScreen visible={showSplash} />
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ActiveRoleProvider>
              <RideBookingProvider>
                <AppContent />
              </RideBookingProvider>
            </ActiveRoleProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
