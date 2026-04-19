
Looking at the codebase, both terms are currently used interchangeably:

- **Routes**: `/business`, `/business/apply`, `/business/dashboard` (URL uses "business")
- **Pages**: `BusinessLanding.tsx`, `BusinessDashboard.tsx`, `BusinessMembers.tsx`, `BusinessInvoices.tsx`, `BusinessRides.tsx`, but also `CorporateApply.tsx`
- **Profile column**: `is_business`
- **Active role**: `"business"`
- **DB tables**: `organization_applications`, `organizations` (uses "organization" internally)
- **UI copy**: mixes "Corporate Account Application", "business account", "corporate application"
- **Memory**: `mem://features/corporate-billing`

This inconsistency is a real UX/naming smell — users see "Business" in the nav but land on a "Corporate Account Application" page.

## Recommendation: Standardize on "Business" everywhere user-facing

**Why "Business" wins:**
1. **Already the URL/route standard** (`/business/*`) — changing routes breaks SEO, bookmarks, and the existing memory entries.
2. **Already the capability flag** (`is_business`, `ActiveRole = "business"`) — changing breaks the multi-role refactor we just stabilized.
3. **More inclusive** — "Corporate" implies large enterprises; "Business" covers sole proprietors, small shops, and corporates alike. Better for Yellowknife's small-business market.
4. **Shorter, friendlier**, matches industry norm (Uber for Business, Lyft Business).
5. **Keep "Organization" as the internal data model term** (DB tables, edge functions) — that's a standard backend convention and users never see it.

## Proposed naming convention

| Layer | Term | Example |
|---|---|---|
| User-facing UI/copy | **Business** | "Business account", "Apply for Business" |
| Routes | **business** | `/business`, `/business/apply` |
| Capability/role | **business** | `is_business`, `activeRole: "business"` |
| Internal data model | **organization** | `organizations` table, `organization_applications` |
| Billing context only | **Corporate billing** OK as a feature name | invoice descriptions, admin reports |

## Concrete changes (small, surgical)

1. **`src/pages/CorporateApply.tsx`** → rename to `BusinessApply.tsx`; update import in `App.tsx`.
2. **UI copy sweep** in that file:
   - "Corporate Account Application" → "Business Account Application"
   - "Apply for a business account" stays
   - "Corporate Application" header → "Business Application"
3. **`AdminCorporate.tsx`** — keep filename (admin-only, "Corporate accounts" is clearer for the admin reviewing high-value billing relationships), but ensure user-facing emails/notifications say "Business".
4. **Email template** `corporate-application-notification.tsx` — keep filename (internal), but verify subject/body uses consistent terminology.
5. **i18n keys** in `en.json`/`fr.json` — audit any `corporate.*` keys used in rider-facing UI and rename to `business.*` (keep admin keys as-is).
6. **Memory update** — adjust `mem://features/corporate-billing` description to clarify: "User-facing term is Business; Corporate is reserved for admin/billing internals."

## What stays "Corporate"
- Admin pages (`AdminCorporate.tsx`, admin nav label) — admins manage "corporate accounts" as a billing concept
- Internal DB schema (`organizations`, `organization_applications`)
- Generated invoice numbers / accounting language where "corporate" is industry-standard

## Out of scope (don't change)
- Database schema/columns
- Route paths
- `ActiveRole` type
- `is_business` profile column

Net result: **one consistent user-facing term ("Business")**, internal data model unchanged, admin "Corporate" terminology preserved where it adds clarity.
