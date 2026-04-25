/**
 * Unit tests for the shared payment-authorization validator.
 *
 * Run with:
 *   deno test supabase/functions/_tests/authorize-amount.test.ts
 *
 * These tests pin down the contract that `estimated_fare_cents` is the
 * **bylaw subtotal** (pre-tax, pre-fee) and that the validator never
 * double-counts GST or the $0.97 platform fee.
 */
import {
  assertEquals,
  assert,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  AUTH_CEILING_CENTS,
  AUTH_FLOOR_CENTS,
  MAX_REASONABLE_SUBTOTAL_CENTS,
  MIN_REASONABLE_SUBTOTAL_CENTS,
  validateAndComputeAuthorization,
} from "../_shared/authorize-amount.ts";
import { FALLBACK_BYLAW_RATES } from "../_shared/pricing.ts";

const GST = FALLBACK_BYLAW_RATES.pickyou_gst_rate; // 0.05
const FEE = FALLBACK_BYLAW_RATES.pickyou_platform_fee_cents; // 97

// -----------------------------------------------------------------------------
// Bad input rejection
// -----------------------------------------------------------------------------
Deno.test("rejects missing estimated_fare_cents", () => {
  const r = validateAndComputeAuthorization(undefined, "taxi");
  assertEquals(r.ok, false);
  if (!r.ok) assertEquals(r.code, "missing");
});

Deno.test("rejects null estimated_fare_cents", () => {
  const r = validateAndComputeAuthorization(null, "private_hire");
  assertEquals(r.ok, false);
  if (!r.ok) assertEquals(r.code, "missing");
});

Deno.test("rejects non-numeric (string)", () => {
  const r = validateAndComputeAuthorization("1500" as unknown, "taxi");
  assertEquals(r.ok, false);
  if (!r.ok) assertEquals(r.code, "not_integer");
});

Deno.test("rejects float (non-integer cents)", () => {
  const r = validateAndComputeAuthorization(1500.5, "taxi");
  assertEquals(r.ok, false);
  if (!r.ok) assertEquals(r.code, "not_integer");
});

Deno.test("rejects NaN", () => {
  const r = validateAndComputeAuthorization(NaN, "taxi");
  assertEquals(r.ok, false);
  if (!r.ok) assertEquals(r.code, "not_integer");
});

Deno.test("rejects Infinity", () => {
  const r = validateAndComputeAuthorization(Infinity, "taxi");
  assertEquals(r.ok, false);
  if (!r.ok) assertEquals(r.code, "not_integer");
});

Deno.test("rejects zero", () => {
  const r = validateAndComputeAuthorization(0, "taxi");
  assertEquals(r.ok, false);
  if (!r.ok) assertEquals(r.code, "not_positive");
});

Deno.test("rejects negative", () => {
  const r = validateAndComputeAuthorization(-100, "taxi");
  assertEquals(r.ok, false);
  if (!r.ok) assertEquals(r.code, "not_positive");
});

Deno.test("rejects subtotal below bylaw flag rate", () => {
  const r = validateAndComputeAuthorization(
    MIN_REASONABLE_SUBTOTAL_CENTS - 1,
    "taxi",
  );
  assertEquals(r.ok, false);
  if (!r.ok) assertEquals(r.code, "below_min");
});

Deno.test("rejects subtotal above the maximum plausible cap", () => {
  const r = validateAndComputeAuthorization(
    MAX_REASONABLE_SUBTOTAL_CENTS + 1,
    "private_hire",
  );
  assertEquals(r.ok, false);
  if (!r.ok) assertEquals(r.code, "above_max");
});

// -----------------------------------------------------------------------------
// Taxi mode — no GST, no platform fee
// -----------------------------------------------------------------------------
Deno.test("taxi: subtotal passes through with NO GST and NO platform fee", () => {
  const subtotal = 1500; // $15
  const r = validateAndComputeAuthorization(subtotal, "taxi");
  assert(r.ok);
  if (!r.ok) return;
  assertEquals(r.subtotalCents, subtotal);
  assertEquals(
    r.fareWithExtrasCents,
    subtotal,
    "Taxi must never add GST or fees",
  );
  assertEquals(r.isPrivateHire, false);
  // 125% of $15 = $18.75 → clamped up to $20 floor
  assertEquals(r.authorizedAmountCents, AUTH_FLOOR_CENTS);
});

Deno.test("taxi: large fare → 125% buffer applied, under ceiling", () => {
  const subtotal = 4000; // $40
  const r = validateAndComputeAuthorization(subtotal, "taxi");
  assert(r.ok);
  if (!r.ok) return;
  assertEquals(r.authorizedAmountCents, Math.round(4000 * 1.25)); // 5000
});

Deno.test("taxi: huge fare clamps to ceiling", () => {
  const subtotal = 90_000; // $900
  const r = validateAndComputeAuthorization(subtotal, "taxi");
  assert(r.ok);
  if (!r.ok) return;
  assertEquals(r.authorizedAmountCents, AUTH_CEILING_CENTS);
});

// -----------------------------------------------------------------------------
// Private Hire mode — GST + $0.97 fee, applied EXACTLY ONCE
// -----------------------------------------------------------------------------
Deno.test("private_hire: adds 5% GST + $0.97 fee exactly once", () => {
  const subtotal = 2000; // $20
  const r = validateAndComputeAuthorization(subtotal, "private_hire");
  assert(r.ok);
  if (!r.ok) return;

  const expectedTax = Math.round(subtotal * GST); // 100
  const expectedFareWithExtras = subtotal + expectedTax + FEE; // 2197

  assertEquals(r.subtotalCents, subtotal);
  assertEquals(r.fareWithExtrasCents, expectedFareWithExtras);
  assertEquals(r.isPrivateHire, true);
  assertEquals(
    r.authorizedAmountCents,
    Math.min(
      Math.max(Math.round(expectedFareWithExtras * 1.25), AUTH_FLOOR_CENTS),
      AUTH_CEILING_CENTS,
    ),
  );
});

Deno.test("private_hire: validator output is idempotent under double calls", () => {
  // Calling twice with the SAME subtotal must produce the SAME amounts.
  // This proves the validator itself does not accumulate.
  const subtotal = 3500;
  const r1 = validateAndComputeAuthorization(subtotal, "private_hire");
  const r2 = validateAndComputeAuthorization(subtotal, "private_hire");
  assert(r1.ok && r2.ok);
  if (!(r1.ok && r2.ok)) return;
  assertEquals(r1.fareWithExtrasCents, r2.fareWithExtrasCents);
  assertEquals(r1.authorizedAmountCents, r2.authorizedAmountCents);
});

Deno.test("private_hire: passing the GST+fee-inclusive total is rejected when prior subtotal is known", () => {
  // First authorization: subtotal = $35.
  const subtotal = 3500;
  const first = validateAndComputeAuthorization(subtotal, "private_hire");
  assert(first.ok);
  if (!first.ok) return;

  // Client erroneously sends back the GROSSED-UP total instead of the subtotal.
  const grossedUp = subtotal + Math.round(subtotal * GST) + FEE; // 3500 + 175 + 97 = 3772
  const second = validateAndComputeAuthorization(
    grossedUp,
    "private_hire",
    subtotal, // previouslyAuthorizedSubtotal
  );
  assertEquals(second.ok, false);
  if (!second.ok) assertEquals(second.code, "looks_gst_inclusive");
});

Deno.test("private_hire: a legitimately higher new subtotal is NOT flagged as GST-inclusive", () => {
  // Original subtotal: $20. New subtotal: $30 (e.g. driver added waiting time).
  // $30 is not within 1¢ of $20 + 5% + $0.97 ($21.97), so it must pass.
  const r = validateAndComputeAuthorization(3000, "private_hire", 2000);
  assert(r.ok);
});

Deno.test("private_hire: rejects when subtotal == prior * 1.05 + 97 within 1¢", () => {
  // Edge case: prior $50.00 → grossed $52.97. Sending 5297 must be rejected.
  const prior = 5000;
  const grossed = prior + Math.round(prior * GST) + FEE; // 5297
  const r = validateAndComputeAuthorization(grossed, "private_hire", prior);
  assertEquals(r.ok, false);
  if (!r.ok) assertEquals(r.code, "looks_gst_inclusive");
});

Deno.test("taxi mode never triggers GST-inclusive heuristic (no GST applies)", () => {
  // Even when the value happens to match the formula, taxi has no GST so the
  // heuristic should not fire — we only guard against double-charging in
  // private_hire mode.
  const prior = 5000;
  const looksGrossed = prior + Math.round(prior * GST) + FEE;
  const r = validateAndComputeAuthorization(looksGrossed, "taxi", prior);
  assert(r.ok, "Taxi mode must not flag this value");
});

// -----------------------------------------------------------------------------
// Service-type handling
// -----------------------------------------------------------------------------
Deno.test("unknown service_type is treated as non-private-hire (no GST/fee)", () => {
  const subtotal = 2000;
  const r = validateAndComputeAuthorization(subtotal, "courier");
  assert(r.ok);
  if (!r.ok) return;
  assertEquals(r.isPrivateHire, false);
  assertEquals(r.fareWithExtrasCents, subtotal);
});

Deno.test("missing service_type defaults to non-private-hire", () => {
  const subtotal = 2000;
  const r = validateAndComputeAuthorization(subtotal, null);
  assert(r.ok);
  if (!r.ok) return;
  assertEquals(r.isPrivateHire, false);
  assertEquals(r.fareWithExtrasCents, subtotal);
});
