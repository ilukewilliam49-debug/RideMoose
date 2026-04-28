import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// --- Mocks ----------------------------------------------------------------

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-driver-step2", email: "driver@pickyou.test" },
    profile: null,
    loading: false,
  }),
}));

vi.mock("@/components/landing/LandingNav", () => ({ default: () => null }));
vi.mock("@/components/landing/LandingFooter", () => ({ default: () => null }));

const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { error: (...a: any[]) => toastError(...a), success: vi.fn() },
}));

const cloudStore = new Map<string, any>();
const upsertSpy = vi.fn();

vi.mock("@/integrations/supabase/client", () => {
  const buildQuery = () => {
    const state: { userId?: string } = {};
    const api: any = {
      select: () => api,
      eq: (_c: string, v: string) => {
        state.userId = v;
        return api;
      },
      maybeSingle: async () => ({
        data: state.userId ? cloudStore.get(state.userId) ?? null : null,
        error: null,
      }),
      upsert: async (row: any) => {
        upsertSpy(row);
        cloudStore.set(row.applicant_user_id, {
          step: row.step,
          form: row.form,
          file_names: row.file_names,
          saved_at: row.saved_at,
        });
        return { error: null };
      },
      delete: () => ({
        eq: async (_c: string, v: string) => {
          cloudStore.delete(v);
          return { error: null };
        },
      }),
    };
    return api;
  };
  return { supabase: { from: () => buildQuery() } };
});

import DriverApply from "./DriverApply";

const CURRENT_YEAR = new Date().getFullYear();
const MIN_VEHICLE_YEAR = CURRENT_YEAR - 15;

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/driver-apply"]}>
      <DriverApply />
    </MemoryRouter>,
  );

// Fill Step 1 with valid contact data so we can advance to Step 2.
async function fillStepOneAndAdvance() {
  const fullName = await screen.findByLabelText(/full name/i);
  // Wait for the async restore effect before typing so auto-save isn't blocked.
  await new Promise((r) => setTimeout(r, 50));
  fireEvent.change(fullName, { target: { value: "Alex Driver" } });
  fireEvent.change(screen.getByLabelText(/^email$/i), {
    target: { value: "alex@example.com" },
  });
  fireEvent.change(screen.getByLabelText(/phone number/i), {
    target: { value: "(867) 555-0199" },
  });
  fireEvent.click(screen.getByRole("button", { name: /continue/i }));
  // Step 2 marker
  await screen.findByText(/which tier are you applying for\?/i);
}

describe("DriverApply — Step 2 (Vehicle & Tier) persistence + validation", () => {
  beforeEach(() => {
    cloudStore.clear();
    upsertSpy.mockClear();
    toastError.mockClear();
    localStorage.clear();
    sessionStorage.clear();
  });

  it("rejects a vehicle older than the 15-year limit with an inline error", async () => {
    renderPage();
    await fillStepOneAndAdvance();

    const pickyouRadio = document.getElementById("tier-pickyou")!;
    fireEvent.click(pickyouRadio.closest("label")!);
    fireEvent.change(screen.getByLabelText(/make/i), { target: { value: "Toyota" } });
    fireEvent.change(screen.getByLabelText(/model/i), { target: { value: "Camry" } });
    fireEvent.change(screen.getByLabelText(/year/i), {
      target: { value: String(MIN_VEHICLE_YEAR - 1) },
    });

    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() => {
      expect(
        screen.getByText(
          new RegExp(`Vehicle must be ${MIN_VEHICLE_YEAR} or newer`, "i"),
        ),
      ).toBeInTheDocument();
    });
    expect(toastError).toHaveBeenCalled();
  });

  it("saves Step 2 (Taxi tier + valid vehicle) to the cloud and restores after reload", async () => {
    const { unmount } = renderPage();
    await fillStepOneAndAdvance();

    // Pick the Taxi tier by clicking its label (which wraps the RadioGroupItem).
    const taxiRadio = document.getElementById("tier-taxi")!;
    fireEvent.click(taxiRadio.closest("label")!);

    const validYear = MIN_VEHICLE_YEAR + 2;
    fireEvent.change(screen.getByLabelText(/make/i), { target: { value: "Toyota" } });
    fireEvent.change(screen.getByLabelText(/model/i), { target: { value: "Camry" } });
    fireEvent.change(screen.getByLabelText(/year/i), {
      target: { value: String(validYear) },
    });

    // Wait for the debounced (800ms) cloud upsert to flush with the LATEST
    // values — not just an earlier intermediate save from the tier click.
    await waitFor(
      () => {
        const last = upsertSpy.mock.calls.at(-1)?.[0];
        expect(last?.form?.tier).toBe("taxi");
        expect(last?.form?.vehicle_make).toBe("Toyota");
        expect(last?.form?.vehicle_model).toBe("Camry");
        expect(last?.form?.vehicle_year).toBe(String(validYear));
        // Step index for Vehicle & Tier is 1.
        expect(last?.step).toBe(1);
      },
      { timeout: 5000, interval: 50 },
    );

    // And the UI must reflect the synced state before we tear down.
    await waitFor(
      () => {
        expect(screen.getByText(/synced to your account/i)).toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    // Confirm what's actually in the mocked cloud store before "reloading".
    const stored = cloudStore.get("user-driver-step2");
    expect(stored?.form?.vehicle_year).toBe(String(validYear));
    expect(stored?.step).toBe(1);

    // ---- Simulate reload ----
    unmount();
    cleanup();
    renderPage();

    // Wait for the async restore effect to:
    //   1. Read the cloud row,
    //   2. Set step back to 1 (so Step 2 fields render), and
    //   3. Hydrate the form state.
    // The "Draft auto-saved" banner only renders once draftSavedAt is set,
    // which happens at the end of the restore effect — perfect signal.
    await screen.findByText(/draft auto-saved/i, undefined, { timeout: 5000 });
    await screen.findByText(/which tier are you applying for\?/i);

    await waitFor(
      () => {
        expect((screen.getByLabelText(/make/i) as HTMLInputElement).value).toBe(
          "Toyota",
        );
      },
      { timeout: 3000, interval: 50 },
    );
    expect((screen.getByLabelText(/model/i) as HTMLInputElement).value).toBe("Camry");
    expect((screen.getByLabelText(/year/i) as HTMLInputElement).value).toBe(
      String(validYear),
    );

    // The Taxi radio should be the selected one (aria-checked="true").
    const restoredTaxi = document.getElementById("tier-taxi")!;
    expect(restoredTaxi.getAttribute("aria-checked")).toBe("true");
    const restoredPickyou = document.getElementById("tier-pickyou")!;
    expect(restoredPickyou.getAttribute("aria-checked")).not.toBe("true");

    // Restoration banner present, and not in cloud-error state.
    expect(screen.getByText(/draft auto-saved/i)).toBeInTheDocument();
    expect(screen.queryByText(/cloud sync failed/i)).not.toBeInTheDocument();

    // Continue button should now succeed (valid step), advancing to Documents.
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    await screen.findByLabelText(/driver's license/i);
  }, 15000);
});
