

# Plan: Transfer "Where to?" address to /rider/rides dropoff

## Problem
When a user enters a destination in the "Where to?" field on `/rider`, the app navigates to `/rider/rides` with `dropoff`, `dlat`, and `dlng` URL parameters — but `useRideBookingState` never reads those parameters. So the dropoff field arrives empty.

## Solution
Add a `useEffect` in `useRideBookingState.ts` that reads the `dropoff`, `dlat`, and `dlng` search params on mount and initializes the dropoff state accordingly.

## Technical Details

**File: `src/hooks/useRideBookingState.ts`**

Add after the existing `useEffect` for geolocation (~line 63):

```typescript
// Pre-fill dropoff from URL params (passed from DashboardHome "Where to?")
useEffect(() => {
  const dropoffParam = searchParams.get("dropoff");
  const dlatParam = searchParams.get("dlat");
  const dlngParam = searchParams.get("dlng");
  if (dropoffParam) {
    setDropoff(decodeURIComponent(dropoffParam));
    if (dlatParam && dlngParam) {
      setDropoffCoords({ lat: parseFloat(dlatParam), lng: parseFloat(dlngParam) });
    }
  }
}, []); // Run once on mount
```

This is a single-file, ~10-line change. No other files need modification since DashboardHome already passes the correct URL parameters.

