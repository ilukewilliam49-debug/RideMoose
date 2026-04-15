

# Fix Existing Favicon — Remove Tiny Letters

## What this does
Removes the small text from the bottom of the existing favicon/icon images while keeping the pin/location marker graphic intact.

## Approach
The current `public/favicon.png` (1024×1024) has a blue/orange location pin icon in the center with small text below it (rows ~600–752). Rather than generating a new image from scratch, we'll programmatically erase the text region by making those pixels transparent, then re-center the remaining icon graphic.

## Steps

1. **Erase text from favicon.png** — Use Python/Pillow to zero out alpha in the text region (rows below the main icon body, approximately row 600+), keeping only the pin graphic.

2. **Re-center and crop** — After removing the text, re-crop to the icon's bounding box and re-center it within the 1024×1024 canvas for a balanced look.

3. **Regenerate icon-512.png and icon-192.png** — Resize the cleaned favicon to 512×512 and 192×192 for PWA manifest icons.

4. **Verify** — Render the result on a dark background to confirm no remnant text is visible.

No HTML or code changes needed — just fixing the three image files.

