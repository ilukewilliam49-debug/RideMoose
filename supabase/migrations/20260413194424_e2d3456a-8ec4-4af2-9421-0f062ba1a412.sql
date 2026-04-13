
-- Re-add rides to Realtime publication since the app depends on it
-- for live ride status updates. RLS on rides already scopes data per user.
ALTER PUBLICATION supabase_realtime ADD TABLE public.rides;
