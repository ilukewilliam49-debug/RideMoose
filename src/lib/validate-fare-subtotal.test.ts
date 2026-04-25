import { describe, it, expect } from "vitest";
import {
  validateFareSubtotalCents,
  SUBTOTAL_MIN_CENTS,
  SUBTOTAL_MAX_CENTS,
} from "./validate-fare-subtotal";
import { FALLBACK_BYLAW_RATES } from "./pricing";

describe("validateFareSubtotalCents", () => {
  it("accepts a normal taxi subtotal", () => {
    const r = validateFareSubtotalCents(1500, { serviceType: "taxi" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.subtotalCents).toBe(1500);
  });

  it("accepts the minimum flag rate", () => {
    const r = validateFareSubtotalCents(SUBTOTAL_MIN_CENTS, { serviceType: "taxi" });
    expect(r.ok).toBe(true);
  });

  it("rejects null/undefined as missing", () => {
    expect(validateFareSubtotalCents(undefined).ok).toBe(false);
    expect(validateFareSubtotalCents(null).ok).toBe(false);
  });

  it("rejects strings and floats as not_integer", () => {
    const a = validateFareSubtotalCents("1500" as unknown);
    const b = validateFareSubtotalCents(1500.5);
    expect(a.ok).toBe(false);
    expect(b.ok).toBe(false);
    if (!a.ok) expect(a.code).toBe("not_integer");
    if (!b.ok) expect(b.code).toBe("not_integer");
  });

  it("rejects zero and negative values", () => {
    const r = validateFareSubtotalCents(0);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(["not_positive", "below_min"]).toContain(r.code);
  });

  it("rejects values below the bylaw flag rate", () => {
    const r = validateFareSubtotalCents(100);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("below_min");
  });

  it("rejects values above the maximum sanity ceiling", () => {
    const r = validateFareSubtotalCents(SUBTOTAL_MAX_CENTS + 1);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("above_max");
  });

  it("flags GST-inclusive resubmissions for private_hire", () => {
    const prev = 2000;
    const inclusive =
      prev +
      Math.round(prev * FALLBACK_BYLAW_RATES.pickyou_gst_rate) +
      FALLBACK_BYLAW_RATES.pickyou_platform_fee_cents;
    const r = validateFareSubtotalCents(inclusive, {
      serviceType: "private_hire",
      previousSubtotalCents: prev,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("looks_gst_inclusive");
  });

  it("does not flag GST-inclusive heuristic for taxi", () => {
    const prev = 2000;
    const inclusive =
      prev +
      Math.round(prev * FALLBACK_BYLAW_RATES.pickyou_gst_rate) +
      FALLBACK_BYLAW_RATES.pickyou_platform_fee_cents;
    const r = validateFareSubtotalCents(inclusive, {
      serviceType: "taxi",
      previousSubtotalCents: prev,
    });
    expect(r.ok).toBe(true);
  });

  it("includes a human-readable message on failure", () => {
    const r = validateFareSubtotalCents(100);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.message).toMatch(/minimum|flag rate/i);
      expect(r.message.length).toBeGreaterThan(10);
    }
  });
});
