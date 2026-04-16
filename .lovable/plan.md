
The user wants a designed, optimized driver onboarding flow — screen-by-screen spec with copy, UI, progress, doc upload, approval messaging. They want fewer steps than Uber, mobile-first, high conversion.

I already have full context on the current flow (DriverOnboarding.tsx is now 3 steps: Contact → Vehicle → Documents, plus DriverOnboardingPending and the new DriverWelcomeFlow). So this plan is about *redesigning what's there* — tightening copy, adding micro-interactions, smoothing flow — not building from scratch.

Strategy: deliver a compact spec the user can approve, then implement as a focused refactor of existing files. No new routes, no schema changes.

## Plan: Optimized Driver Onboarding v2

### Goal
Cut perceived effort by ~40%. Target: signup → submitted in **under 4 minutes** on mobile. Match or beat Uber's 5-step flow with **3 visible steps + 1 review**.

### The flow (4 screens, 1 of which is auto-progress)

```
[1] Apply CTA  →  [2] Account  →  [3] Vehicle  →  [4] Documents  →  [5] Submitted/Pending
   (/drive)        (/login)        (onboarding)    (onboarding)       (pending)
```

User-perceived steps inside `/driver/onboarding`: **3 dots, ~90s each.**

---

### Screen-by-screen spec

**Screen 1 — Pre-application hook (already exists at `/drive`)**
- Sticky CTA "Apply in 4 minutes" (currently says "Apply now" — change to time-bound).
- Below CTA: "No fees. Keep 95.1%. Approved in 24 hrs." trust strip.

**Screen 2 — Account (existing `/login`, minor tweaks)**
- Add visible "I want to drive" badge at top when `?role=driver` is in URL.
- Default to Google OAuth as primary button (1-tap).
- Email/password collapsed under "Use email instead."
- Copy: "Create your driver account" (not generic "Sign in").

**Screen 3 — Step 1 of 3: Contact (~30 seconds)**
- Headline: **"Let's start with you"**
- Subhead: "We'll text you when riders need you."
- Fields: Full name, Mobile number (with country code).
- Inline validation: green check on valid phone format.
- Helper under phone: "We'll send a verification code next."
- CTA button: **"Continue →"** (full-width, sticky bottom on mobile).
- Progress: `● ○ ○  Step 1 of 3 · About you`

**Screen 4 — Step 2 of 3: Your vehicle (~60 seconds)**
- Headline: **"Tell us about your ride"**
- Subhead: "Must be 2016 or newer."
- Fields stacked, single column:
  1. Vehicle type — visual chip selector (Sedan / SUV / Van / Truck) with icons
  2. Year (numeric pad, min 2016)
  3. Make + Model (side-by-side on `sm+`, stacked on mobile)
  4. Color (chip selector: Black / White / Silver / Grey / Blue / Red / Other)
  5. Plate number (uppercase auto-format)
  6. Seats (chip: 4 / 5 / 6 / 7+)
- Each field shows inline ✓ when valid. Continue button stays visible but greyed until valid.
- Progress: `● ● ○  Step 2 of 3 · Your vehicle`
- Microcopy at bottom: "Vehicle info can be updated later."

**Screen 5 — Step 3 of 3: Documents (~2 min)**
Headline: **"Upload 3 documents"**
Subhead: "Snap a photo or pick from your gallery. Takes about 2 minutes."

For each document card (already uses `DocumentUploadCard`):
- Icon + label ("Driver's License")
- 1-line "what" + 1-line "why we need it"
- "Take photo" (primary, opens camera via `capture="environment"`) and "Upload file" (secondary)
- After upload: thumbnail preview, "Replace" link, green check
- Tips collapsed by default ("See tips" expands)

Per-document mini-progress at top: **"2 of 3 uploaded"** with thin progress bar.

After all 3 uploaded → big sticky CTA: **"Submit application →"**

Progress: `● ● ●  Step 3 of 3 · Documents`

**Screen 6 — Submitted (success moment, before pending)**
Full-screen success state for 2s before auto-routing to `/driver/onboarding/pending`:
- Animated checkmark (Framer Motion scale + spring)
- "Application submitted!"
- "We're reviewing now. Most drivers approved within 24 hours."

**Screen 7 — Pending (existing `DriverOnboardingPending`, refined)**
- ETA banner at top: **"Most reviews complete within 24 hours"** (already added)
- Submission timestamp ("Submitted Today at 2:34 PM")
- Per-doc status with re-upload affordance for rejected
- "Contact support" button (already added)
- New: **"What happens next?"** collapsible explaining the 3 stages
- Push notification will fire when status changes

**Screen 8 — Approved (already built — `DriverWelcomeFlow`)**
- Confetti celebration → 3-card tour → Go online.

---

### UI / interaction details

- **Sticky CTA** at bottom of viewport on mobile (`safe-area-inset-bottom` aware).
- **One field per visual focus** — keyboard pushes view, label stays visible.
- **No modal dialogs** during onboarding — full-page transitions only.
- **Auto-save on blur** for every field → resume where they left off.
- **Inline error states** with red border + icon + 1-line fix instruction.
- **Skeleton loading** when rehydrating saved state.
- **Haptic-style feedback** via subtle scale animation on button tap.

### Progress indicator design
Replace current pill dots with a labelled top bar:

```
┌─────────────────────────────────┐
│ ●━━━━━●━━━━━○   2 of 3          │
│ About    Vehicle    Documents   │
└─────────────────────────────────┘
```

- Filled circle = done, ring = current, hollow = upcoming
- Tap a completed step to go back and edit

### Approval messaging copy bank

| State | Headline | Body |
|---|---|---|
| Submitted | "Application submitted!" | "We're reviewing now. You'll get a notification within 24 hours." |
| Pending | "Under review" | "Most drivers approved within 24 hours. We'll notify you the moment you're cleared." |
| Doc rejected | "One thing needs attention" | "Your {doc} couldn't be verified. Tap below to re-upload." |
| Approved | "You're approved! 🎉" | "Welcome to PickYou. Let's get you online." |

---

### Files to edit (no new files)

- `src/pages/DriverOnboarding.tsx` — restructure to use new step UI, labelled progress bar, sticky CTA, vehicle chip selectors, success transition screen
- `src/components/driver/DocumentUploadCard.tsx` — make "Take photo" the primary CTA (mobile), collapse tips
- `src/pages/DriverOnboardingPending.tsx` — add submission timestamp display + "What happens next" collapsible
- `src/pages/Login.tsx` — add "I want to drive" badge when `?role=driver`, promote Google to primary
- `src/pages/DriveLanding.tsx` — change CTA copy to "Apply in 4 minutes"
- `src/i18n/en.json` + `src/i18n/fr.json` — add new copy keys

### Out of scope (next sprint)
- OCR auto-approval (would need Lovable AI vision integration)
- Background-check integration (third-party)
- Document expiry tracking (DB schema additions)

### Effort
~half day. After approval I'll ship all edits and you can test the full flow end-to-end.
