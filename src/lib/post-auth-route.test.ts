import { describe, it, expect } from "vitest";
import {
  resolvePostAuthRoute,
  normalizeIntent,
  intentToCapabilityColumn,
  isSafeReturnTo,
  type RoutingProfile,
} from "./post-auth-route";

const baseProfile: RoutingProfile = {
  is_rider: true,
  is_driver: false,
  is_business: false,
  rider_onboarding_complete: true,
  driver_onboarding_complete: false,
  business_onboarding_complete: false,
  last_used_role: null,
};

describe("normalizeIntent", () => {
  it("accepts rider/driver/business case-insensitively", () => {
    expect(normalizeIntent("Rider")).toBe("rider");
    expect(normalizeIntent("DRIVER")).toBe("driver");
    expect(normalizeIntent("business")).toBe("business");
  });
  it("rejects unknown / empty values", () => {
    expect(normalizeIntent(null)).toBeNull();
    expect(normalizeIntent("")).toBeNull();
    expect(normalizeIntent("admin")).toBeNull();
  });
});

describe("intentToCapabilityColumn", () => {
  it("maps each self-provisionable intent to the correct column", () => {
    expect(intentToCapabilityColumn("driver")).toBe("is_driver");
    expect(intentToCapabilityColumn("rider")).toBe("is_rider");
  });
  it("business is admin-approval gated and never auto-provisioned", () => {
    expect(intentToCapabilityColumn("business")).toBeNull();
  });
  it("returns null for unknown / empty intents", () => {
    expect(intentToCapabilityColumn(null)).toBeNull();
  });
});

describe("isSafeReturnTo", () => {
  it("blocks unsafe paths", () => {
    expect(isSafeReturnTo(null)).toBe(false);
    expect(isSafeReturnTo("")).toBe(false);
    expect(isSafeReturnTo("https://evil.com")).toBe(false);
    expect(isSafeReturnTo("//evil.com")).toBe(false);
    expect(isSafeReturnTo("/login")).toBe(false);
    expect(isSafeReturnTo("/auth/callback")).toBe(false);
  });
  it("allows safe in-app paths", () => {
    expect(isSafeReturnTo("/rider")).toBe(true);
    expect(isSafeReturnTo("/business/apply")).toBe(true);
  });
});

describe("resolvePostAuthRoute — admin", () => {
  it("admin always wins over everything", () => {
    expect(
      resolvePostAuthRoute(baseProfile, {
        isAdmin: true,
        intent: "driver",
        returnTo: "/business",
        activeRole: "rider",
      }),
    ).toBe("/admin");
  });
});

describe("resolvePostAuthRoute — intent", () => {
  it("driver intent → onboarding when incomplete", () => {
    expect(resolvePostAuthRoute(baseProfile, { intent: "driver" })).toBe("/driver/onboarding");
  });
  it("driver intent → /driver when onboarding complete", () => {
    expect(
      resolvePostAuthRoute(
        { ...baseProfile, is_driver: true, driver_onboarding_complete: true },
        { intent: "driver" },
      ),
    ).toBe("/driver");
  });
  it("business intent → /business/apply when not yet a business", () => {
    expect(resolvePostAuthRoute(baseProfile, { intent: "business" })).toBe("/business/apply");
  });
  it("business intent → /business when already a business", () => {
    expect(
      resolvePostAuthRoute({ ...baseProfile, is_business: true }, { intent: "business" }),
    ).toBe("/business");
  });
  it("rider intent → /rider", () => {
    expect(resolvePostAuthRoute(baseProfile, { intent: "rider" })).toBe("/rider");
  });
});

describe("resolvePostAuthRoute — returnTo", () => {
  it("safe returnTo wins over default routing for non-admins", () => {
    expect(resolvePostAuthRoute(baseProfile, { returnTo: "/business/apply" })).toBe(
      "/business/apply",
    );
  });
  it("unsafe returnTo is ignored", () => {
    expect(resolvePostAuthRoute(baseProfile, { returnTo: "https://evil.com" })).toBe("/rider");
  });
  it("admin ignores returnTo", () => {
    expect(
      resolvePostAuthRoute(baseProfile, { isAdmin: true, returnTo: "/business" }),
    ).toBe("/admin");
  });
});

describe("resolvePostAuthRoute — Bug #2: dual-role driver onboarding trap", () => {
  it("dual-role rider+driver with incomplete driver onboarding falls back to /rider", () => {
    // Was previously trapped in /driver/onboarding on every login.
    expect(
      resolvePostAuthRoute(
        {
          ...baseProfile,
          is_rider: true,
          is_driver: true,
          driver_onboarding_complete: false,
          last_used_role: "driver",
        },
        {},
      ),
    ).toBe("/rider");
  });
  it("driver-only with incomplete onboarding still goes to /driver/onboarding", () => {
    expect(
      resolvePostAuthRoute(
        {
          ...baseProfile,
          is_rider: false,
          is_driver: true,
          driver_onboarding_complete: false,
          last_used_role: "driver",
        },
        {},
      ),
    ).toBe("/driver/onboarding");
  });
  it("dual-role with COMPLETE driver onboarding routes to /driver", () => {
    expect(
      resolvePostAuthRoute(
        {
          ...baseProfile,
          is_driver: true,
          driver_onboarding_complete: true,
          last_used_role: "driver",
        },
        {},
      ),
    ).toBe("/driver");
  });
});

describe("resolvePostAuthRoute — activeRole", () => {
  it("activeRole=driver routes to /driver when capable + onboarded", () => {
    expect(
      resolvePostAuthRoute(
        { ...baseProfile, is_driver: true, driver_onboarding_complete: true },
        { activeRole: "driver" },
      ),
    ).toBe("/driver");
  });
  it("activeRole=business routes to /business when capable", () => {
    expect(
      resolvePostAuthRoute(
        { ...baseProfile, is_business: true },
        { activeRole: "business" },
      ),
    ).toBe("/business");
  });
  it("activeRole ignored when capability missing", () => {
    expect(resolvePostAuthRoute(baseProfile, { activeRole: "driver" })).toBe("/rider");
  });
});

describe("resolvePostAuthRoute — fallbacks", () => {
  it("no profile + no intent → /rider", () => {
    expect(resolvePostAuthRoute(null)).toBe("/rider");
  });
  it("no profile + driver intent → /driver/onboarding", () => {
    expect(resolvePostAuthRoute(null, { intent: "driver" })).toBe("/driver/onboarding");
  });
  it("no profile + business intent → /business/apply", () => {
    expect(resolvePostAuthRoute(null, { intent: "business" })).toBe("/business/apply");
  });
  it("triple-role with no hints → /rider fallback", () => {
    expect(
      resolvePostAuthRoute(
        {
          ...baseProfile,
          is_driver: true,
          is_business: true,
          driver_onboarding_complete: true,
        },
        {},
      ),
    ).toBe("/rider");
  });
});

// ============================================================
// Full role × state × entry-path matrix.
// Catches regressions in any cell of the multi-role grid.
// ============================================================
type ProfileShape = "rider-only" | "driver-only" | "driver-incomplete" | "business-only" | "dual-rider-driver" | "triple";

const profiles: Record<ProfileShape, RoutingProfile | null> = {
  "rider-only": { ...baseProfile, is_rider: true, is_driver: false, is_business: false },
  "driver-only": {
    ...baseProfile,
    is_rider: false,
    is_driver: true,
    is_business: false,
    driver_onboarding_complete: true,
    last_used_role: "driver",
  },
  "driver-incomplete": {
    ...baseProfile,
    is_rider: false,
    is_driver: true,
    driver_onboarding_complete: false,
    last_used_role: "driver",
  },
  "business-only": {
    ...baseProfile,
    is_rider: false,
    is_business: true,
    last_used_role: "business",
  },
  "dual-rider-driver": {
    ...baseProfile,
    is_rider: true,
    is_driver: true,
    driver_onboarding_complete: true,
  },
  "triple": {
    ...baseProfile,
    is_rider: true,
    is_driver: true,
    is_business: true,
    driver_onboarding_complete: true,
  },
};

describe("Routing matrix — driver intent never bounces capable users", () => {
  it.each<[ProfileShape, string]>([
    ["rider-only", "/driver/onboarding"], // capability flipped server-side, then routed
    ["driver-only", "/driver"],
    ["driver-incomplete", "/driver/onboarding"],
    ["dual-rider-driver", "/driver"],
    ["triple", "/driver"],
  ])("driver intent: %s → %s", (shape, expected) => {
    expect(resolvePostAuthRoute(profiles[shape], { intent: "driver" })).toBe(expected);
  });
});

describe("Routing matrix — business intent always lands on a business surface", () => {
  it.each<[ProfileShape, string]>([
    ["rider-only", "/business/apply"],
    ["driver-only", "/business/apply"],
    ["business-only", "/business"],
    ["dual-rider-driver", "/business/apply"],
    ["triple", "/business"],
  ])("business intent: %s → %s", (shape, expected) => {
    expect(resolvePostAuthRoute(profiles[shape], { intent: "business" })).toBe(expected);
  });
});

describe("Routing matrix — rider intent always lands on /rider", () => {
  it.each<ProfileShape>([
    "rider-only",
    "driver-only",
    "driver-incomplete",
    "business-only",
    "dual-rider-driver",
    "triple",
  ])("rider intent: %s → /rider", (shape) => {
    expect(resolvePostAuthRoute(profiles[shape], { intent: "rider" })).toBe("/rider");
  });
});

describe("Routing matrix — admin overrides every shape + intent", () => {
  it.each<[ProfileShape, string | null]>([
    ["rider-only", "driver"],
    ["driver-only", "business"],
    ["business-only", "rider"],
    ["triple", null],
  ])("admin: shape=%s intent=%s → /admin", (shape, intent) => {
    expect(
      resolvePostAuthRoute(profiles[shape], { isAdmin: true, intent, returnTo: "/business/apply" }),
    ).toBe("/admin");
  });
});

describe("Routing matrix — safe returnTo always honoured for non-admins", () => {
  it.each<ProfileShape>([
    "rider-only",
    "driver-only",
    "business-only",
    "dual-rider-driver",
    "triple",
  ])("returnTo=/business/apply: %s → honoured", (shape) => {
    expect(
      resolvePostAuthRoute(profiles[shape], { returnTo: "/business/apply" }),
    ).toBe("/business/apply");
  });
});

describe("Capability provisioning — business is never auto-flipped", () => {
  it("intentToCapabilityColumn no longer maps business (admin-approval gated)", () => {
    expect(intentToCapabilityColumn("business")).toBeNull();
  });
});
