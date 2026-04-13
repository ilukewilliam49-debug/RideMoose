
-- Create a view that excludes sensitive Stripe columns for driver access
CREATE OR REPLACE VIEW public.driver_rides AS
SELECT 
  id, rider_id, driver_id, status, service_type,
  pickup_address, pickup_lat, pickup_lng, pickup_notes,
  dropoff_address, dropoff_lat, dropoff_lng, dropoff_notes,
  estimated_price, final_price, final_fare_cents, distance_km, duration_min,
  waiting_min, passenger_count, pricing_model, payment_option,
  scheduled_at, created_at, updated_at, started_at, completed_at,
  meter_status, meter_started_at, meter_ended_at,
  tip_cents, cancellation_reason, cancellation_fee_cents,
  billed_to, organization_id, cost_center, po_number,
  package_size, item_description, weight_estimate_kg,
  requires_loading_help, stairs_involved, marketplace_delivery,
  proof_photo_required, proof_photo_url, signature_required,
  store_name, store_id, quantity, order_value_cents,
  estimated_item_cost_cents, final_item_cost_cents,
  delivery_fee_cents, shopper_fee_cents, receipt_photo_url,
  bidding_ends_at, price_increase_count,
  dispatched_to_driver_id, dispatch_expires_at,
  driver_earnings_cents, commission_cents, service_fee_cents, tax_cents,
  invoiced, invoice_id
FROM public.rides;

-- The view inherits RLS from the underlying rides table, so no additional policies needed
