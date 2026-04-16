

# Deploy PickYou to Netlify

## Overview
Export the project code and set up Netlify deployment so pickyou.ca serves your app directly from Netlify.

## Steps

### 1. Create `public/_redirects` for Netlify SPA routing
Add a `public/_redirects` file with `/* /index.html 200` so Netlify handles client-side routing (deep links like `/privacy` won't 404 on refresh).

### 2. Export and deploy
Lovable supports self-hosting via GitHub. The recommended flow:
1. **Connect to GitHub** — Go to **Project Settings** (click project name top-left → Settings) and link to a GitHub repository
2. **Pull the repo** to your local machine or connect Netlify to that GitHub repo directly
3. In Netlify, set:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
   - **Node version**: 18+
4. Set environment variables in Netlify dashboard:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_SUPABASE_PROJECT_ID`
   (Copy values from your `.env` file)

### 3. Point pickyou.ca to Netlify
Since your domain is already on Netlify, just assign it to the new Netlify site in **Netlify → Domain settings**.

## What I'll do now (code changes)
- Create `public/_redirects` with `/* /index.html 200`

Everything else (GitHub connection, Netlify config, domain assignment) is done by you in the respective dashboards.

## Important note
Your backend (database, auth, edge functions) stays on Lovable Cloud — only the frontend is served from Netlify. The Supabase/Cloud URLs remain the same.

