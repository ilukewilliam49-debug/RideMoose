-- Enable realtime on profiles table for live driver location tracking
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;