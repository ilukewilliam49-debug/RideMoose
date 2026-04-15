

# Fix Privacy Policy Link for Google Verification

## Problem
Google's OAuth verification crawler can't find the privacy policy link on your home page because the footer uses JavaScript `<button onClick={navigate(...)}>` elements instead of standard HTML `<a href="...">` anchor tags. Crawlers don't execute JavaScript click handlers.

## Changes needed

**File: `src/components/landing/LandingFooter.tsx`**
- Replace all `<button onClick={() => navigate("/path")}>` elements with `<a href="/path">` anchor tags (using React Router's `<Link>` component to preserve SPA navigation)
- Affected links: Terms of Service, Privacy Policy, Business, Ride, Drive, Courier

This ensures Google's crawler can discover `/privacy` and `/terms` links on your home page, which should resolve the verification issue.

## Technical details
- Swap `useNavigate()` + `<button onClick>` for React Router `<Link to="...">` components
- `<Link>` renders a real `<a>` tag with an `href` attribute (crawlable) while still doing client-side navigation
- No visual change to users

