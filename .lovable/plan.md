
The user wants to build the deferred `/drive` marketing landing page. I have enough context already (LandingDriver.tsx, LandingNav, LandingFooter, branding memory, driver onboarding flow). No need to ask clarifying questions — scope is clear from the prior audit.

## Plan: Dedicated `/drive` Marketing Landing Page

A standalone, conversion-optimized page that sells driving for PickYou — separate from the main landing page — designed to convert prospective drivers into applicants.

### Route
- New route `/drive` in `App.tsx` (public, no auth required)
- Update "Drive" link in `LandingNav.tsx` to point to `/drive` instead of scrolling to a section
- "Apply now" CTAs route to `/login?role=driver`

### Page structure (single scrollable page, mobile-first)

1. **Hero** — Full-bleed driver image, headline "Drive in Yellowknife. Earn on your schedule.", subhead, sticky "Apply now" CTA, secondary "How it works" anchor link.

2. **Earnings strip** — 3 stat cards: "95.1% you keep", "$1,200+ avg weekly", "Weekly payouts".

3. **Interactive earnings calculator** — Two sliders (hours/week 5–60, days/week 1–7) → live projected weekly + monthly take-home. Pure client-side math using a configurable per-hour rate (~$28/hr Yellowknife benchmark, before commission). Shows "Estimate only — actual earnings vary."

4. **How it works (4 steps)** — Apply → Upload docs → Get approved (24h) → Start earning. Numbered cards with icons.

5. **Requirements checklist** — Self-qualification ("Valid driver's license > 1 year", "Vehicle 2016 or newer", "Clean driving record", "Smartphone"). Lets unqualified drivers self-deselect.

6. **Why PickYou** — 4 perks: low 4.9% commission, flexible hours, multi-service (taxi/courier/delivery), local Yellowknife support.

7. **FAQ accordion** — 6–8 questions: How much can I earn? When do I get paid? What are the requirements? How long does approval take? What documents do I need? Can I drive part-time? Is insurance covered? How does commission work?

8. **Trust strip** — "Background-checked drivers", "Local Yellowknife operations", "Secure document handling".

9. **Final CTA band** — Big "Start your application" button + "Questions? Contact support" link.

10. **Footer** — Reuse `LandingFooter.tsx`.

### Files to create/edit

- **Create** `src/pages/DriveLanding.tsx` — main page
- **Create** `src/components/drive/EarningsCalculator.tsx` — interactive sliders + projection
- **Create** `src/components/drive/DriveFAQ.tsx` — accordion
- **Create** `src/components/drive/DriveHero.tsx` — hero section
- **Create** `src/components/drive/DriveHowItWorks.tsx` — 4-step section
- **Create** `src/components/drive/DriveRequirements.tsx` — checklist
- **Edit** `src/App.tsx` — add lazy-loaded `/drive` route (public)
- **Edit** `src/components/landing/LandingNav.tsx` — point "Drive" link to `/drive`
- **Edit** `src/components/landing/LandingDriver.tsx` — change "Drive" CTA to link to `/drive` (keep section as teaser on main landing)
- **Edit** `src/i18n/en.json` and `src/i18n/fr.json` — add `drive.*` translation keys for all copy

### Design system
- Reuse existing branding (dark theme #0B0F1A, primary #2F80ED, accent #F2994A)
- Framer Motion fade-up animations consistent with `LandingHero` / `LandingDriver`
- Tailwind responsive — mobile-first, two-column layouts on `md+`
- Accessible: semantic headings, focus rings, accordion uses Radix `Collapsible`

### SEO
- Add `<title>` and `<meta description>` via document head update on mount
- Headline targets "Drive in Yellowknife", "rideshare driver Yellowknife", "PickYou driver application"
- Add to `public/sitemap.xml`

### Out of scope (next sprint)
- Server-side rendered earnings (stays client-side)
- Real-time driver count or surge data
- Video testimonials
- Referral program signup

### Estimated effort
~1 day. After approval, I'll build all components, wire the route, add i18n keys, and update the sitemap.
