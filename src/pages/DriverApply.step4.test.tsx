import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// --- Mocks ----------------------------------------------------------------

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-driver-step4", email: "driver@pickyou.test" },
    profile: null,
    loading: false,
  }),
}));

vi.mock("@/components/landing/LandingNav", () => ({ default: () => null }));
vi.mock("@/components/landing/LandingFooter", () => ({ default: () => null }));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
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
const VALID_YEAR = CURRENT_YEAR - 13;

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/driver-apply"]}>
      <DriverApply />
    </MemoryRouter>,
  );

const makeFile = (name: string) =>
  new File(["x"], name, { type: "application/pdf" });

async function fillThroughStep4() {
  const fullName = await screen.findByLabelText(/full name/i);
  await new Promise((r) => setTimeout(r, 50));
  fireEvent.change(fullName, { target: { value: "Alex Driver" } });
  fireEvent.change(screen.getByLabelText(/^email$/i), {
    target: { value: "alex@example.com" },
  });
  fireEvent.change(screen.getByLabelText(/phone number/i), {
    target: { value: "(867) 555-0199" },
  });
  fireEvent.click(screen.getByRole("button", { name: /continue/i }));

  await screen.findByText(/which tier are you applying for\?/i);
  fireEvent.click(document.getElementById("tier-pickyou")!.closest("label")!);
  fireEvent.change(screen.getByLabelText(/make/i), { target: { value: "Toyota" } });
  fireEvent.change(screen.getByLabelText(/model/i), { target: { value: "Camry" } });
  fireEvent.change(screen.getByLabelText(/year/i), {
    target: { value: String(VALID_YEAR) },
  });
  fireEvent.click(screen.getByRole("button", { name: /continue/i }));

  await screen.findByLabelText(/driver's license/i);
  fireEvent.change(document.getElementById("drivers_license") as HTMLInputElement, {
    target: { files: [makeFile("license.pdf")] },
  });
  fireEvent.change(
    document.getElementById("vehicle_registration") as HTMLInputElement,
    { target: { files: [makeFile("registration.pdf")] } },
  );
  fireEvent.change(
    document.getElementById("proof_of_insurance") as HTMLInputElement,
    { target: { files: [makeFile("insurance.pdf")] } },
  );
  fireEvent.click(screen.getByRole("button", { name: /continue/i }));

  // Step 4 — Review
  await screen.findByText(/review your application/i);
}

describe("DriverApply — Step 4 (Review) reload persistence", () => {
  beforeEach(() => {
    cloudStore.clear();
    upsertSpy.mockClear();
    localStorage.clear();
    sessionStorage.clear();
  });

  it("persists Step 4 review summary and Submit button after reload", async () => {
    const { unmount } = renderPage();
    await fillThroughStep4();

    // Sanity: pre-reload review shows the document filenames inline.
    expect(screen.getByText(/step 4 of 4/i)).toBeInTheDocument();
    expect(screen.getByText("license.pdf")).toBeInTheDocument();
    expect(screen.getByText("registration.pdf")).toBeInTheDocument();
    expect(screen.getByText("insurance.pdf")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /submit application/i }),
    ).toBeEnabled();

    // Wait for the debounced upsert to flush with step=3 (Review).
    await waitFor(
      () => {
        const last = upsertSpy.mock.calls.at(-1)?.[0];
        expect(last?.step).toBe(3);
        expect(last?.form?.tier).toBe("pickyou");
        expect(last?.file_names?.drivers_license).toBe("license.pdf");
      },
      { timeout: 5000, interval: 50 },
    );

    // Confirm cloud store before reload.
    const stored = cloudStore.get("user-driver-step4");
    expect(stored?.step).toBe(3);

    // ---- Simulate reload ----
    unmount();
    cleanup();
    renderPage();

    // Restore effect signals completion via the auto-saved banner.
    await screen.findByText(/draft auto-saved/i, undefined, { timeout: 5000 });

    // Should land back on Step 4 (Review) with the form fields restored.
    await screen.findByText(/review your application/i);
    expect(screen.getByText(/step 4 of 4/i)).toBeInTheDocument();

    // Persisted form data must appear in the review summary.
    expect(screen.getByText("Alex Driver")).toBeInTheDocument();
    expect(screen.getByText("alex@example.com")).toBeInTheDocument();
    expect(screen.getByText("(867) 555-0199")).toBeInTheDocument();
    expect(screen.getByText("PickYou")).toBeInTheDocument();
    expect(
      screen.getByText(`${VALID_YEAR} Toyota Camry`),
    ).toBeInTheDocument();

    // Document blobs are NOT persisted across sessions — the summary rows
    // should show "—" until the user re-attaches, AND the missing-files
    // banner should warn them to re-attach 3 documents.
    const dlRow = screen.getByText("Driver's License").closest("div")!;
    expect(dlRow.textContent).toMatch(/—/);
    const regRow = screen.getByText("Registration").closest("div")!;
    expect(regRow.textContent).toMatch(/—/);
    const insRow = screen.getByText("Insurance").closest("div")!;
    expect(insRow.textContent).toMatch(/—/);
    expect(screen.getByText(/re-attach 3 files/i)).toBeInTheDocument();

    // Submit button must still be present and clickable on the restored
    // Step 4 — but submission must be blocked because documents are missing.
    const submitBtn = screen.getByRole("button", { name: /submit application/i });
    expect(submitBtn).toBeInTheDocument();
    expect(submitBtn).toBeEnabled();

    // Back button should also be available, allowing the user to navigate
    // back to Step 3 to re-attach files.
    const backBtn = screen.getByRole("button", { name: /^back$/i });
    expect(backBtn).toBeEnabled();

    // Cloud sync state must be healthy after restore (not in error mode).
    expect(screen.queryByText(/cloud sync failed/i)).not.toBeInTheDocument();

    // The cloud row should still match exactly what we persisted before reload.
    const cloudRow = cloudStore.get("user-driver-step4");
    expect(cloudRow?.step).toBe(3);
    expect(cloudRow?.form?.full_name).toBe("Alex Driver");
    expect(cloudRow?.form?.tier).toBe("pickyou");
    expect(cloudRow?.form?.vehicle_make).toBe("Toyota");
    expect(cloudRow?.form?.vehicle_model).toBe("Camry");
    expect(cloudRow?.form?.vehicle_year).toBe(String(VALID_YEAR));
    expect(cloudRow?.file_names).toEqual({
      drivers_license: "license.pdf",
      vehicle_registration: "registration.pdf",
      proof_of_insurance: "insurance.pdf",
      chauffeurs_permit: null,
    });
  }, 20000);
});
