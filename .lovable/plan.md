

# Upgrade Admin Hire Zones to a Map-First Experience

## Overview
Replace the current text-heavy, JSON-editing zone management with an interactive map-based interface inspired by Uber's zone management tools.

## What changes

### 1. Add an interactive map to the Geofence Boundaries tab
- Embed a Leaflet (free, no API key needed) or Google Maps instance showing Yellowknife area
- Render all existing geo zones as colored polygon overlays on the map
- Clicking a zone on the map selects it in the sidebar for editing
- Color-code each zone using the existing `color` field

### 2. Draw-on-map polygon creation
- Add a polygon drawing tool (Leaflet Draw plugin) so admins can click points on the map to define a new zone boundary
- On completing a polygon, auto-populate the zone_key/zone_name form and store coordinates — no JSON typing needed
- Support editing existing polygons by dragging vertices on the map

### 3. Redesign the layout to a split-panel view
- **Left panel (sidebar)**: scrollable list of zones with name, key, color swatch, and action buttons
- **Right panel (map)**: full-height interactive map showing all zone polygons
- Selecting a zone in the sidebar highlights it on the map and opens an edit drawer

### 4. Route Pricing tab improvements
- Show a visual matrix/table of pickup zone → dropoff zone with fare amounts
- Dropdown selectors that pull from actual geo zone keys instead of free-text input
- Display fare in dollars (not cents) with proper formatting

## Technical approach

### New dependencies
- `leaflet` + `react-leaflet` + `@types/leaflet` for the map
- `leaflet-draw` for polygon drawing tools (or `@geoman-io/leaflet-geoman-free`)

### Files to create/modify
- **Create** `src/components/admin/ZoneMap.tsx` — Leaflet map component rendering geo zone polygons with draw controls
- **Create** `src/components/admin/ZoneListPanel.tsx` — Sidebar list of zones with edit/delete actions  
- **Modify** `src/pages/AdminZones.tsx` — Restructure layout to split-panel (sidebar + map), wire up zone selection state between list and map

### Map component details
- Center on Yellowknife (62.454, -114.372) at zoom ~12
- Use free OpenStreetMap tiles (no API key required)
- Each geo zone rendered as a `<Polygon>` with its stored color and 30% opacity fill
- Draw control enables polygon creation; on `draw:created` event, extract coordinates and open the "Add Geofence" form pre-filled
- On polygon edit (`draw:edited`), update the coordinates in state
- Clicking an existing polygon selects it and scrolls the sidebar to that zone

### Pricing matrix
- Replace the current card-per-route layout with a clean data table
- Zone key inputs become `<Select>` dropdowns populated from `geo_zones` query
- Fare displayed as `$50.00` instead of `5000` cents

## What stays the same
- All database tables (`geo_zones`, `private_hire_zones`) unchanged
- All mutations and RLS policies unchanged  
- The `pointInPolygon` geofence logic unchanged
- Mobile fallback: on small screens, stack map below the list instead of side-by-side

