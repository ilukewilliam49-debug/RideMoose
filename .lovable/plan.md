

# Remove Route Pricing (Dead Code Cleanup)

Since both taxi and private hire use metered pricing, the flat-fare route pricing system is unused. This plan removes it cleanly.

## Changes

### 1. Fix pricing_model in RiderDashboard.tsx
- Change `pricing_model` for `private_hire` from `"flat_zone"` to `"metered"`

### 2. Remove private_hire_zones query from useRideQueries.ts
- Delete the `privateHireZones` query, `matchedZone` memo, and related zone-matching logic (`pickupZoneKey`, `dropoffZoneKey`, `detectZone`)
- Remove these from the return object

### 3. Clean up PriceEstimate.tsx
- Remove `matchedZone`, `pickupZoneKey`, `dropoffZoneKey` props if no longer used

### 4. Remove Route Pricing tab from AdminZones.tsx
- Remove the route pricing CRUD UI (the tab that manages `private_hire_zones` records)
- Keep the geo zones map/list functionality

### 5. Keep the database table for now
- The `private_hire_zones` table can stay (no harm), or be dropped later. No migration needed immediately.

## Files to modify
- `src/pages/RiderDashboard.tsx`
- `src/hooks/useRideQueries.ts`
- `src/components/rider/PriceEstimate.tsx`
- `src/pages/AdminZones.tsx`

