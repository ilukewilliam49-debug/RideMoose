
Your Uber-style homepage lives at **`/rider`** (the Rider Dashboard / "Home" tab for signed-in riders).

It's rendered by `src/pages/DashboardHome.tsx`, which uses the two-pane layout we built:
- **Desktop**: sticky "Get a ride" form on the left (380px), large map with nearby drivers on the right.
- **Mobile**: map on top (Yellowknife-centered, ~42vh), booking form stacked below.

Note: signed-out visitors going to `pickyou.ca/` see the marketing landing page (`src/pages/Index.tsx` → `LandingHero`). Once signed in, they're auto-redirected from `/` to `/rider` — which is the Uber-style page.

No changes needed — this is a question, not an implementation request.
