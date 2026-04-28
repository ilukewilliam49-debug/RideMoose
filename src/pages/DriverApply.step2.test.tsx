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

    // Strict equality check: restored UI state must match the mocked cloud row
    // exactly across tier + vehicle fields, before any further interaction.
    const cloudRow = cloudStore.get("user-driver-step2");
    expect(cloudRow).toBeTruthy();
    const restoredState = {
      tier:
        document.getElementById("tier-taxi")?.getAttribute("aria-checked") === "true"
          ? "taxi"
          : document.getElementById("tier-pickyou")?.getAttribute("aria-checked") ===
              "true"
            ? "pickyou"
            : null,
      vehicle_make: (screen.getByLabelText(/make/i) as HTMLInputElement).value,
      vehicle_model: (screen.getByLabelText(/model/i) as HTMLInputElement).value,
      vehicle_year: (screen.getByLabelText(/year/i) as HTMLInputElement).value,
    };
    expect(restoredState).toEqual({
      tier: cloudRow.form.tier,
      vehicle_make: cloudRow.form.vehicle_make,
      vehicle_model: cloudRow.form.vehicle_model,
      vehicle_year: cloudRow.form.vehicle_year,
    });

    // Restoration banner present, and not in cloud-error state.
    expect(screen.getByText(/draft auto-saved/i)).toBeInTheDocument();
    expect(screen.queryByText(/cloud sync failed/i)).not.toBeInTheDocument();

    // Continue button should now succeed (valid step), advancing to Documents.
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    await screen.findByLabelText(/driver's license/i);
  }, 15000);

  it("highlights ALL Step 2 inline errors after a reload that lands on an empty Vehicle & Tier screen", async () => {
    const { unmount } = renderPage();
    await fillStepOneAndAdvance();

    // We're on Step 2 with NO vehicle fields filled. The debounced auto-save
    // should still flush a cloud row with step=1 (form has step-1 contact data
    // so isFormEmpty is false).
    await waitFor(
      () => {
        const last = upsertSpy.mock.calls.at(-1)?.[0];
        expect(last?.step).toBe(1);
        expect(last?.form?.full_name).toBe("Alex Driver");
        expect(last?.form?.tier).toBe("");
        expect(last?.form?.vehicle_make).toBe("");
        expect(last?.form?.vehicle_model).toBe("");
        expect(last?.form?.vehicle_year).toBe("");
      },
      { timeout: 5000, interval: 50 },
    );

    // ---- Simulate reload ----
    unmount();
    cleanup();
    toastError.mockClear();
    renderPage();

    // Restore lands us back on Step 2.
    await screen.findByText(/draft auto-saved/i, undefined, { timeout: 5000 });
    await screen.findByText(/which tier are you applying for\?/i);
    expect(screen.getByText(/step 2 of 4/i)).toBeInTheDocument();

    // No errors visible before Continue is clicked.
    expect(screen.queryByText(/choose a tier/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^required$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/enter a year/i)).not.toBeInTheDocument();

    // Click Continue with all Step 2 fields empty.
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    // Inline tier error.
    await screen.findByText(/choose a tier/i);

    // Make + model render the literal "Required" message via Zod min(...).
    const requiredMessages = screen.getAllByText(/^required$/i);
    expect(requiredMessages.length).toBeGreaterThanOrEqual(2);

    // Year is empty -> Number("") = NaN -> "Enter a year" message.
    expect(screen.getByText(/enter a year/i)).toBeInTheDocument();

    // a11y: each invalid field input is marked aria-invalid="true".
    expect(
      (screen.getByLabelText(/make/i) as HTMLInputElement).getAttribute(
        "aria-invalid",
      ),
    ).toBe("true");
    expect(
      (screen.getByLabelText(/model/i) as HTMLInputElement).getAttribute(
        "aria-invalid",
      ),
    ).toBe("true");
    expect(
      (screen.getByLabelText(/year/i) as HTMLInputElement).getAttribute(
        "aria-invalid",
      ),
    ).toBe("true");

    // Toast error fires telling the user to fix the highlighted fields.
    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        "Please correct the highlighted fields",
      );
    });

    // Form must NOT have advanced to Step 3 (Documents).
    expect(screen.getByText(/step 2 of 4/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/driver's license/i)).not.toBeInTheDocument();
  }, 15000);

  it("highlights only the missing Step 2 fields after a reload that lands on a partially-filled Vehicle & Tier screen", async () => {
    const { unmount } = renderPage();
    await fillStepOneAndAdvance();

    // Fill ONLY tier + make. Leave model + year empty.
    fireEvent.click(document.getElementById("tier-pickyou")!.closest("label")!);
    fireEvent.change(screen.getByLabelText(/make/i), {
      target: { value: "Toyota" },
    });

    await waitFor(
      () => {
        const last = upsertSpy.mock.calls.at(-1)?.[0];
        expect(last?.step).toBe(1);
        expect(last?.form?.tier).toBe("pickyou");
        expect(last?.form?.vehicle_make).toBe("Toyota");
        expect(last?.form?.vehicle_model).toBe("");
        expect(last?.form?.vehicle_year).toBe("");
      },
      { timeout: 5000, interval: 50 },
    );

    // ---- Simulate reload ----
    unmount();
    cleanup();
    toastError.mockClear();
    renderPage();

    await screen.findByText(/draft auto-saved/i, undefined, { timeout: 5000 });
    await screen.findByText(/which tier are you applying for\?/i);

    // Restored values.
    expect((screen.getByLabelText(/make/i) as HTMLInputElement).value).toBe(
      "Toyota",
    );
    expect((screen.getByLabelText(/model/i) as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText(/year/i) as HTMLInputElement).value).toBe("");

    // Click Continue — should fail validation on model + year only.
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    // Model + year missing → inline errors visible.
    await screen.findByText(/enter a year/i);
    const requiredMessages = screen.getAllByText(/^required$/i);
    // Exactly one "Required" (model). Make is filled, so make has none.
    expect(requiredMessages).toHaveLength(1);

    // Tier was satisfied, so no "Choose a tier" error.
    expect(screen.queryByText(/choose a tier/i)).not.toBeInTheDocument();

    // Make is valid → not marked aria-invalid.
    expect(
      (screen.getByLabelText(/make/i) as HTMLInputElement).getAttribute(
        "aria-invalid",
      ),
    ).not.toBe("true");

    // Model + year are invalid.
    expect(
      (screen.getByLabelText(/model/i) as HTMLInputElement).getAttribute(
        "aria-invalid",
      ),
    ).toBe("true");
    expect(
      (screen.getByLabelText(/year/i) as HTMLInputElement).getAttribute(
        "aria-invalid",
      ),
    ).toBe("true");

    // Did NOT advance.
    expect(screen.getByText(/step 2 of 4/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/driver's license/i)).not.toBeInTheDocument();

    // Filling the missing fields and clicking Continue should now advance,
    // and the previously-shown errors must clear.
    fireEvent.change(screen.getByLabelText(/model/i), {
      target: { value: "Camry" },
    });
    fireEvent.change(screen.getByLabelText(/year/i), {
      target: { value: String(MIN_VEHICLE_YEAR + 2) },
    });

    await waitFor(() => {
      expect(screen.queryByText(/^required$/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/enter a year/i)).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    await screen.findByLabelText(/driver's license/i);
  }, 15000);
});
