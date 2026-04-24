import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Regression guard for the homepage layout.
 *
 * The "Built for the way you move" services section was removed to keep the
 * homepage focused on primary actions (Ride / Drive / Business). This test
 * prevents accidental reintroduction and ensures the surrounding sections
 * remain flush — i.e. no leftover vertical gap on any breakpoint.
 *
 * It is a static-source check (not a DOM render) so it stays fast and avoids
 * pulling in Supabase, the lazy map, auth, and i18n just to assert structure.
 */

const indexSrc = readFileSync(
  resolve(__dirname, "./Index.tsx"),
  "utf-8",
);

describe("Homepage layout — responsive gap regression", () => {
  it("does not import the removed LandingServices component", () => {
    expect(indexSrc).not.toMatch(/from\s+["']@\/components\/landing\/LandingServices["']/);
    expect(indexSrc).not.toMatch(/<LandingServices\b/);
  });

  it("does not leave the LandingServices source file in the project", () => {
    const file = resolve(__dirname, "../components/landing/LandingServices.tsx");
    expect(existsSync(file)).toBe(false);
  });

  it("renders Hero immediately followed by Driver section (no intermediate block)", () => {
    // Allow whitespace/newlines between the two tags but nothing else.
    const adjacency = /<LandingHero\s*\/>\s*<LandingDriver\s*\/>/;
    expect(indexSrc).toMatch(adjacency);
  });

  it("keeps the Driver section's top border so it sits flush with the hero", () => {
    const driverSrc = readFileSync(
      resolve(__dirname, "../components/landing/LandingDriver.tsx"),
      "utf-8",
    );
    // The shared section border is what visually closes the gap left by the
    // removed services block. Losing it would create a perceived empty band.
    expect(driverSrc).toMatch(/border-t\s+border-border\/30/);
  });

  it("keeps the bottom CTA section's top border so the layout remains tight", () => {
    // Bottom CTA lives inline in Index.tsx; assert it still has the divider
    // that separates it from the Driver section without introducing a gap.
    expect(indexSrc).toMatch(/border-t\s+border-border\/30/);
  });

  it("uses responsive vertical padding (py-14 md:py-20) on the bottom CTA, not a hard-coded large gap", () => {
    // Guards against someone re-padding the section to compensate for the
    // missing services block (which would create a visible gap on mobile).
    expect(indexSrc).toMatch(/py-14\s+md:py-20/);
  });
});
