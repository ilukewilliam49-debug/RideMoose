import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Regression guard for the homepage layout.
 *
 * - The "Built for the way you move" services section was removed entirely.
 * - The "Drive with PickYou" recruitment section + bottom CTA must only appear
 *   under the Drive tab (not on Ride or Business). This test enforces both
 *   removals so we can't accidentally re-introduce a misplaced driver block
 *   on the Ride tab or a leftover services grid.
 *
 * Static-source check (not a DOM render) for speed and to avoid pulling in
 * Supabase, the lazy map, auth, and i18n just to assert structure.
 */

const indexSrc = readFileSync(resolve(__dirname, "./Index.tsx"), "utf-8");

describe("Homepage layout — responsive gap regression", () => {
  it("does not import the removed LandingServices component", () => {
    expect(indexSrc).not.toMatch(/from\s+["']@\/components\/landing\/LandingServices["']/);
    expect(indexSrc).not.toMatch(/<LandingServices\b/);
  });

  it("does not leave the LandingServices source file in the project", () => {
    const file = resolve(__dirname, "../components/landing/LandingServices.tsx");
    expect(existsSync(file)).toBe(false);
  });

  it("renders LandingDriver ONLY when the Drive tab is active", () => {
    // The driver block must be gated by `showDriverContent`, and that flag
    // must be a strict equality check on tab === "drive" — no mobile-expand
    // escape hatch, no OR conditions that could leak driver content into Ride.
    expect(indexSrc).toMatch(/showDriverContent\s*&&[\s\S]*<LandingDriver\s*\/>/);
    expect(indexSrc).toMatch(/const\s+showDriverContent\s*=\s*tab\s*===\s*["']drive["']\s*;/);
  });

  it("never references the Ride tab in the driver visibility gate", () => {
    // Defensive check: the showDriverContent expression must not mention
    // "ride" — that would mean driver content can render under Ride.
    const match = indexSrc.match(/const\s+showDriverContent\s*=\s*([^;]+);/);
    expect(match).not.toBeNull();
    expect(match![1]).not.toMatch(/["']ride["']/);
  });

  it("hides the footer on the mobile Ride tab until the user expands", () => {
    expect(indexSrc).toMatch(/const\s+showFooter\s*=/);
    expect(indexSrc).toMatch(/showFooter\s*&&/);
  });

  it("exposes a mobile bottom-sheet 'More' drawer on the Ride tab", () => {
    // The drawer is the mobile expand affordance; it must be wired to the
    // shadcn Drawer component, controlled by `moreOpen`, and trigger label
    // must use the exploreMore i18n key.
    expect(indexSrc).toMatch(/from\s+["']@\/components\/ui\/drawer["']/);
    expect(indexSrc).toMatch(/landing\.exploreMore/);
    expect(indexSrc).toMatch(/setMoreOpen/);
    expect(indexSrc).toMatch(/<DrawerTrigger\b/);
    expect(indexSrc).toMatch(/<DrawerContent\b/);
  });

  it("keeps the Driver section's top border so it sits flush with the hero when shown", () => {
    const driverSrc = readFileSync(
      resolve(__dirname, "../components/landing/LandingDriver.tsx"),
      "utf-8",
    );
    expect(driverSrc).toMatch(/border-t\s+border-border\/30/);
  });

  it("keeps the bottom CTA with a top border divider", () => {
    expect(indexSrc).toMatch(/border-t\s+border-border\/30/);
  });

  it("uses responsive vertical padding (py-14 md:py-20) on the bottom CTA", () => {
    expect(indexSrc).toMatch(/py-14\s+md:py-20/);
  });
});
