
## Goal
When the rider taps the "Where to?" field on the mobile dashboard home, open a full-screen sheet that mirrors the Uber pattern in your reference: header with back button + "Plan your ride", schedule + passenger chips, stacked Pickup/Dropoff inputs with a connecting dot/line, and helper rows underneath (Set location on map, Saved places).

## Scope
**Mobile only.** Desktop layout stays unchanged — pickup/dropoff stay inline in the card on the right.

## New component
`src/components/rider/PlanRideSheet.tsx` — a `Sheet` (side="bottom") rendered full-height (`h-[100dvh]`, rounded only at top).

Contents top → bottom:
1. **Header row** — back arrow (closes sheet) + centered "Plan your ride" title.
2. **Chip row** — two pill buttons:
   - "Pickup now" with clock icon → opens existing schedule popover (Now / 15m / 30m / 1h / Custom).
   - "For me" with person icon → static placeholder for v1 (future "ride for someone else").
3. **Address card** — bordered rounded rectangle:
   - Pickup row (green dot, autocomplete, "Use my location" button).
   - Dashed vertical connector.
   - Dropoff row (square marker, "Where to?" autocomplete, **autofocused on open**).
4. **Helper rows** (tap targets, list-style):
   - **Set location on map** → closes sheet, scrolls map into view.
   - **Saved places** → renders existing `SavedPlaceChips` inline. Tapping a chip fills dropoff + closes sheet.
5. **Continue** button at the bottom, enabled only when both pickup + dropoff are set; navigates to `/rider?pickup=...&dropoff=...` (same URL-param flow `useRideBookingState` already consumes).

## Wiring on mobile (DashboardHome.tsx)
- The mobile-only Pickup row I added above the map stays.
- Replace the inline mobile dropoff (currently below the map) with a **read-only button** styled the same — green/blue dots, "Where to?" placeholder. Tap → `setPlanSheetOpen(true)`.
- Sheet is controlled: receives current pickup/dropoff state + setters as props.
- Desktop (`lg:`) doesn't render the trigger or sheet — existing inline form is unchanged.

## State propagation
- Sheet uses the same setters already in `DashboardHome.tsx` (`setPickupAddress`, `setPickupAddressCoords`, `setDestination`, `setDropoffAddressCoords`, `setScheduledAt`, `setUserLocation`).
- "Continue" reuses the existing navigation pattern to `/rider` with URL params.

## Out of scope (deferred)
- "For me" → ride-for-others (UI-only placeholder).
- "Search in a different city" (not in codebase, skip v1).
- No DB migrations.

## Files touched
- **New**: `src/components/rider/PlanRideSheet.tsx`
- **Edit**: `src/pages/DashboardHome.tsx` — replace mobile dropoff with trigger button + render `<PlanRideSheet />`.
- **i18n**: add keys (`rider.planYourRide`, `rider.pickupNow`, `rider.forMe`, `rider.setLocationOnMap`, `rider.savedPlaces`, `rider.continue`) to `en.json` and `fr.json`.

Approve and I'll implement.
