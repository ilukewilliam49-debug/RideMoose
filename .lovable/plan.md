

# Create Favicon with "P" from Logo

## What this does
Replaces the current favicon (which has a pin/marker icon) with a clean favicon showing just the letter "P" matching the style from the PickYou logo in the nav bar.

## Approach
The logo (`src/assets/logo.png`) shows "PickYou" in a bold modern font — the "P" is white/blue, clean, and geometric. We'll:

1. **Extract the "P"** — Crop the first letter from `src/assets/logo.png` (it's the leftmost character in the 882×255 image)
2. **Create favicon** — Place the extracted "P" centered on a 1024×1024 transparent or dark (#0B0F1A) canvas, sized to fill most of the space for visibility at small sizes
3. **Generate PWA icons** — Resize to `icon-512.png` and `icon-192.png`
4. **QA** — Visually verify all three outputs

## Technical details
- The logo "P" appears to be white text — we'll keep the same color on the dark background (#0B0F1A) for consistency with the brand
- Using Python/Pillow to crop, resize, and compose the images
- Files updated: `public/favicon.png`, `public/icon-512.png`, `public/icon-192.png`
- No HTML changes needed (favicon references already point to these files)

