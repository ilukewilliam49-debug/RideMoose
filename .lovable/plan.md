

## Remove Duplicate "PickYou" Text on Login Page

**Problem**: The logo image already displays "PickYou," and there's an additional `<h1>PickYou</h1>` text below it (line 78), resulting in the brand name appearing twice.

**Fix**: Remove the `<h1>` tag on line 78. The sign-in/sign-up subtitle (`<p>` tag) will remain directly below the logo.

**File**: `src/pages/Login.tsx` — delete line 78.

