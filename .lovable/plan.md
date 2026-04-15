

# Update Sitemap to Use pickyou.ca Domain

## What this does
Changes all URLs in `public/sitemap.xml` from `https://pickyou.lovable.app/` to `https://pickyou.ca/` to match the custom domain already configured elsewhere in the project.

## Current state
- ✅ `index.html` already uses `pickyou.ca` for canonical, Open Graph, JSON-LD
- ✅ `PrivacyPolicy.tsx` already uses `https://pickyou.ca/privacy`
- ✅ `TermsOfService.tsx` already uses `https://pickyou.ca/terms`
- ✅ `robots.txt` already points to `https://pickyou.ca/sitemap.xml`
- ❌ `public/sitemap.xml` still references `pickyou.lovable.app` (30 occurrences)

## Changes needed
Update `public/sitemap.xml`:
- Replace all 30 instances of `https://pickyou.lovable.app/` with `https://pickyou.ca/`
- Affects URLs: `/`, `/login`, `/terms`, `/privacy`, `/corporate-apply`, `/reset-password`

## Technical details
- The sitemap is a static XML file used by search engines
- No code logic changes needed — just URL string replacement
- This completes the domain migration for SEO purposes

