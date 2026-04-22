/**
 * Receipt UI compliance tests.
 *
 * Asserts that the on-screen rider receipt:
 *   • TAXI rides — never render "Service fee", "Platform fee", "GST", or
 *     a $0.97 line, regardless of what fee data is present on the row.
 *   • PICKYOU rides — always render the GST line and the platform fee line.
 *
 * The receipt is gated on `service_type` (defense-in-depth), so we also
 * verify a Taxi row with leaked fee values still renders cleanly with no
 * fee/tax rows visible.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import RideReceipt from "@/components/rider/RideReceipt";
import type { Ride } from "@/types/rider";

// i18n: render English keys/fallbacks directly without provider plumbing.
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

// Avoid loading the real PNG asset under jsdom.
vi.mock("@/assets/logo.png", () => ({ default: "logo.png" }));

function makeRide(overrides: Partial<Ride>): Ride {
  return {
    id: "11111111-2222-3333-4444-555555555555",
    rider_id: "rider-1",
    driver_id: "driver-1",
    pickup_address: "100 Pickup St",
    dropoff_address: "200 Dropoff Ave",
    status: "completed",
    service_type: "taxi",
    payment_option: "card",
    distance_km: 5,
    final_fare_cents: 1836,
    final_price: 18.36,
    estimated_price: 18.36,
    tip_cents: 0,
    tax_cents: 0,
    service_fee_cents: 0,
    captured_amount_cents: 1836,
    outstanding_amount_cents: 0,
    created_at: new Date("2026-04-22T15:00:00Z").toISOString(),
    ...overrides,
  } as unknown as Ride;
}

describe("RideReceipt — TAXI (City-Regulated) UI compliance", () => {
  it("never renders GST, Service fee, or Platform fee rows", () => {
    render(<RideReceipt ride={makeRide({ service_type: "taxi" })} />);
    expect(screen.queryByText(/GST/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Service fee/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Platform fee/i)).not.toBeInTheDocument();
  });

  it("never renders a $0.97 amount", () => {
    render(<RideReceipt ride={makeRide({ service_type: "taxi" })} />);
    expect(screen.queryByText("$0.97")).not.toBeInTheDocument();
  });

  it("DEFENSE-IN-DEPTH: even if tax_cents/service_fee_cents leak in, the UI hides them", () => {
    // Simulate a future data bug where PickYou-only fields end up on a Taxi row.
    render(
      <RideReceipt
        ride={makeRide({
          service_type: "taxi",
          tax_cents: 92, // would-be GST
          service_fee_cents: 97, // would-be platform fee
        })}
      />,
    );
    expect(screen.queryByText(/GST/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Service fee/i)).not.toBeInTheDocument();
    expect(screen.queryByText("$0.97")).not.toBeInTheDocument();
    // Total must equal the bylaw fare only — no leaked cents.
    // ($18.36 appears twice: once in the Fare row, once in the Total row.)
    expect(screen.getAllByText("$18.36").length).toBeGreaterThanOrEqual(2);
  });

  it("renders only Fare + Total (no fee/tax rows) for a regulated trip", () => {
    render(<RideReceipt ride={makeRide({ service_type: "taxi" })} />);
    expect(screen.getByText("Fare")).toBeInTheDocument();
    expect(screen.getByText("Total")).toBeInTheDocument();
    // The fare amount appears for both "Fare" and "Total" rows.
    expect(screen.getAllByText("$18.36").length).toBeGreaterThanOrEqual(2);
  });
});

describe("RideReceipt — PICKYOU Independent UI compliance", () => {
  it("ALWAYS renders the GST (5%) row when GST is present", () => {
    render(
      <RideReceipt
        ride={makeRide({
          service_type: "private_hire",
          final_fare_cents: 1836,
          tax_cents: 92,
          service_fee_cents: 97,
        })}
      />,
    );
    expect(screen.getByText(/GST/i)).toBeInTheDocument();
    expect(screen.getByText("$0.92")).toBeInTheDocument();
  });

  it("ALWAYS renders the $0.97 platform / service fee row", () => {
    render(
      <RideReceipt
        ride={makeRide({
          service_type: "private_hire",
          final_fare_cents: 1836,
          tax_cents: 92,
          service_fee_cents: 97,
        })}
      />,
    );
    expect(screen.getByText(/Service fee/i)).toBeInTheDocument();
    expect(screen.getByText("$0.97")).toBeInTheDocument();
  });

  it("renders Total = fare + GST + platform fee (subtotal + tax + fee)", () => {
    // 18.36 + 0.92 + 0.97 = 20.25
    render(
      <RideReceipt
        ride={makeRide({
          service_type: "private_hire",
          final_fare_cents: 1836,
          tax_cents: 92,
          service_fee_cents: 97,
        })}
      />,
    );
    expect(screen.getByText("$20.25")).toBeInTheDocument();
  });
});
