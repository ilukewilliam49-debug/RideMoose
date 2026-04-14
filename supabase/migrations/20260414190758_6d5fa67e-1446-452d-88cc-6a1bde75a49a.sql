-- Drop dead functions with CASCADE to also remove dependent triggers
DROP FUNCTION IF EXISTS public.notify_pet_transport_drivers() CASCADE;
DROP FUNCTION IF EXISTS public.notify_large_delivery_drivers() CASCADE;
DROP FUNCTION IF EXISTS public.validate_pet_fields() CASCADE;

-- Drop FK from rides to restaurants
ALTER TABLE public.rides DROP CONSTRAINT IF EXISTS rides_restaurant_id_fkey;

-- Drop dead tables (food delivery infrastructure) in dependency order
DROP TABLE IF EXISTS public.food_order_items;
DROP TABLE IF EXISTS public.menu_items;
DROP TABLE IF EXISTS public.menu_categories;
DROP TABLE IF EXISTS public.restaurants;