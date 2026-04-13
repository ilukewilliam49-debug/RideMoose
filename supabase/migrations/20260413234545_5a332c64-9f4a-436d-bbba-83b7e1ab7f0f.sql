
-- Performance indexes for rides table
CREATE INDEX IF NOT EXISTS idx_rides_rider_id_status ON public.rides (rider_id, status);
CREATE INDEX IF NOT EXISTS idx_rides_driver_id_status ON public.rides (driver_id, status);
CREATE INDEX IF NOT EXISTS idx_rides_status ON public.rides (status);
CREATE INDEX IF NOT EXISTS idx_rides_completed_at ON public.rides (completed_at) WHERE completed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rides_organization_id ON public.rides (organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rides_dispatched_to ON public.rides (dispatched_to_driver_id) WHERE dispatched_to_driver_id IS NOT NULL;

-- Performance indexes for profiles table
CREATE INDEX IF NOT EXISTS idx_profiles_role_available ON public.profiles (role, is_available);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles (user_id);

-- Performance indexes for notifications table
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_read ON public.notifications (user_id, read);
