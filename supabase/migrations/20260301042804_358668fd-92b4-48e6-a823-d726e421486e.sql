
-- 1. Add food_delivery to service_type enum
ALTER TYPE public.service_type ADD VALUE IF NOT EXISTS 'food_delivery';

-- 2. Add can_food_delivery capability to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS can_food_delivery boolean NOT NULL DEFAULT false;

-- 3. Restaurants table
CREATE TABLE public.restaurants (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  cuisine_type text,
  address text NOT NULL,
  latitude double precision,
  longitude double precision,
  phone text,
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  opening_hours jsonb DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage restaurants" ON public.restaurants FOR ALL USING (has_role(auth.uid(), 'admin'::user_role));
CREATE POLICY "Anyone authenticated can view active restaurants" ON public.restaurants FOR SELECT USING (is_active = true);

CREATE TRIGGER update_restaurants_updated_at BEFORE UPDATE ON public.restaurants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 4. Menu categories table
CREATE TABLE public.menu_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage menu categories" ON public.menu_categories FOR ALL USING (has_role(auth.uid(), 'admin'::user_role));
CREATE POLICY "Anyone authenticated can view active categories" ON public.menu_categories FOR SELECT USING (is_active = true);

-- 5. Menu items table
CREATE TABLE public.menu_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id uuid NOT NULL REFERENCES public.menu_categories(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price_cents integer NOT NULL,
  image_url text,
  is_available boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage menu items" ON public.menu_items FOR ALL USING (has_role(auth.uid(), 'admin'::user_role));
CREATE POLICY "Anyone authenticated can view available items" ON public.menu_items FOR SELECT USING (is_available = true);

CREATE TRIGGER update_menu_items_updated_at BEFORE UPDATE ON public.menu_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 6. Food orders table (links rides to ordered items)
CREATE TABLE public.food_order_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ride_id uuid NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  menu_item_id uuid NOT NULL REFERENCES public.menu_items(id),
  item_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price_cents integer NOT NULL,
  special_instructions text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.food_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage food order items" ON public.food_order_items FOR ALL USING (has_role(auth.uid(), 'admin'::user_role));
CREATE POLICY "Riders can view own order items" ON public.food_order_items FOR SELECT USING (
  ride_id IN (SELECT r.id FROM public.rides r WHERE r.rider_id IN (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid()))
);
CREATE POLICY "Riders can insert order items" ON public.food_order_items FOR INSERT WITH CHECK (
  ride_id IN (SELECT r.id FROM public.rides r WHERE r.rider_id IN (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid()))
);
CREATE POLICY "Drivers can view assigned order items" ON public.food_order_items FOR SELECT USING (
  ride_id IN (SELECT r.id FROM public.rides r WHERE r.driver_id IN (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid()))
);

-- 7. Add restaurant_id to rides for food_delivery orders
ALTER TABLE public.rides ADD COLUMN IF NOT EXISTS restaurant_id uuid REFERENCES public.restaurants(id);
