-- ============================================================================
-- City of Yellowknife taxi bylaw rates + PickYou independent contractor mode
-- ============================================================================

-- 1. Add bylaw columns to taxi_rates
ALTER TABLE public.taxi_rates
  ADD COLUMN IF NOT EXISTS included_meters integer NOT NULL DEFAULT 150,
  ADD COLUMN IF NOT EXISTS per_increment_cents integer NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS increment_meters integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS large_vehicle_surcharge_cents integer NOT NULL DEFAULT 600,
  ADD COLUMN IF NOT EXISTS pickup_delivery_surcharge_cents integer NOT NULL DEFAULT 300,
  ADD COLUMN IF NOT EXISTS pickyou_platform_fee_cents integer NOT NULL DEFAULT 97,
  ADD COLUMN IF NOT EXISTS pickyou_gst_rate numeric NOT NULL DEFAULT 0.05;

-- 2. Update active rate row to City of Yellowknife bylaw values
--    Flag: $4.70 (470¢)  •  $0.24 / 100m  •  $0.95/min waiting after 3 free min
UPDATE public.taxi_rates
   SET base_fare_cents = 470,
       included_meters = 150,
       per_increment_cents = 24,
       increment_meters = 100,
       per_km_cents = 240,                 -- legacy field kept in sync ($0.24/100m = $2.40/km)
       waiting_per_min_cents = 95,
       free_waiting_min = 3,
       large_vehicle_surcharge_cents = 600,
       pickup_delivery_surcharge_cents = 300,
       pickyou_platform_fee_cents = 97,
       pickyou_gst_rate = 0.05
 WHERE active = true;

-- 3. Add per-ride flags to rides
ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS accessibility_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pickup_delivery_no_passenger boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pickyou_surcharge_cents integer NOT NULL DEFAULT 0;