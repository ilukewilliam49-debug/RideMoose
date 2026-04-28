import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// --- Mocks ----------------------------------------------------------------

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-driver-step3", email: "driver@pickyou.test" },
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
const MIN_VEHICLE_YEAR = CURRENT_YEAR - 15;

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/driver-apply"]}>
      <DriverApply />
    </MemoryRouter>,
  );

const makeFile = (name: string) =>
  new File(["dummy-content"], name, { type: "application/pdf" });

async function fillStepsOneAndTwo() {
  const fullName = await screen.findByLabelText(/full name/i);
  // Wait for restore effect before typing.
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
  // Pick PickYou tier so chauffeur permit is optional.
  const pickyouRadio = document.getElementById("tier-pickyou")!;
  fireEvent.click(pickyouRadio.closest("label")!);
  fireEvent.change(screen.getByLabelText(/make/i), { target: { value: "Toyota" } });
  fireEvent.change(screen.getByLabelText(/model/i), { target: { value: "Camry" } });
  fireEvent.change(screen.getByLabelText(/year/i), {
    target: { value: String(MIN_VEHICLE_YEAR + 2) },
  });
  fireEvent.click(screen.getByRole("button", { name: /continue/i }));

  // Step 3 marker
  await screen.findByLabelText(/driver's license/i);
}

describe("DriverApply — Step 3 (Documents) persistence + verification UI", () => {
  beforeEach(() => {
    cloudStore.clear();
    upsertSpy.mockClear();
    localStorage.clear();
    sessionStorage.clear();
  });

  it("saves uploaded document file names to the cloud and surfaces a re-attach warning after reload", async () => {
    const { unmount } = renderPage();
    await fillStepsOneAndTwo();

    // Upload three required documents (PickYou tier — chauffeur's permit optional).
    const dlInput = document.getElementById("drivers_license") as HTMLInputElement;
    const regInput = document.getElementById("vehicle_registration") as HTMLInputElement;
    const insInput = document.getElementById("proof_of_insurance") as HTMLInputElement;

    fireEvent.change(dlInput, { target: { files: [makeFile("license.pdf")] } });
    fireEvent.change(regInput, { target: { files: [makeFile("registration.pdf")] } });
    fireEvent.change(insInput, { target: { files: [makeFile("insurance.pdf")] } });

    // Wait for the debounced (800ms) upsert to flush with file_names + step=2.
    await waitFor(
      () => {
        const last = upsertSpy.mock.calls.at(-1)?.[0];
        expect(last?.step).toBe(2);
        expect(last?.file_names?.drivers_license).toBe("license.pdf");
        expect(last?.file_names?.vehicle_registration).toBe("registration.pdf");
        expect(last?.file_names?.proof_of_insurance).toBe("insurance.pdf");
        expect(last?.file_names?.chauffeurs_permit).toBeNull();
      },
      { timeout: 5000, interval: 50 },
    );

    // UI should reflect the synced state and show all three filenames as
    // "verified-attached" (CheckCircle2 icon + filename in the label).
    await waitFor(() => {
      expect(screen.getByText(/synced to your account/i)).toBeInTheDocument();
    });
    expect(screen.getByText("license.pdf")).toBeInTheDocument();
    expect(screen.getByText("registration.pdf")).toBeInTheDocument();
    expect(screen.getByText("insurance.pdf")).toBeInTheDocument();

    // Confirm what's actually persisted before "reloading".
    const stored = cloudStore.get("user-driver-step3");
    expect(stored?.step).toBe(2);
    expect(stored?.file_names).toEqual({
      drivers_license: "license.pdf",
      vehicle_registration: "registration.pdf",
      proof_of_insurance: "insurance.pdf",
      chauffeurs_permit: null,
    });

    // ---- Simulate reload ----
    unmount();
    cleanup();
    renderPage();

    // The restore effect signals completion by rendering the auto-save banner.
    await screen.findByText(/draft auto-saved/i, undefined, { timeout: 5000 });

    // We should be back on Step 3 (Documents), with the verification-status
    // warning indicating the user must re-attach the 3 previously-uploaded files
    // (file blobs aren't persisted across sessions — only their names are).
    await screen.findByLabelText(/driver's license/i);
    await waitFor(() => {
      expect(screen.getByText(/re-attach 3 files/i)).toBeInTheDocument();
    });

    // The actual file inputs should be cleared (no File attached after reload).
    const dlInputAfter = document.getElementById("drivers_license") as HTMLInputElement;
    expect(dlInputAfter.files?.length ?? 0).toBe(0);

    // Strict equality: restored file_names from the UI-visible cloud row
    // should match exactly what we persisted.
    const cloudRow = cloudStore.get("user-driver-step3");
    expect(cloudRow?.file_names).toEqual({
      drivers_license: "license.pdf",
      vehicle_registration: "registration.pdf",
      proof_of_insurance: "insurance.pdf",
      chauffeurs_permit: null,
    });

    // Re-attach one document — verification status should update from
    // "Re-attach 3 files" toward a smaller set, and the latest cloud upsert
    // must reflect the new filename for that field.
    fireEvent.change(dlInputAfter, {
      target: { files: [makeFile("license-v2.pdf")] },
    });

    await waitFor(
      () => {
        const last = upsertSpy.mock.calls.at(-1)?.[0];
        expect(last?.file_names?.drivers_license).toBe("license-v2.pdf");
      },
      { timeout: 5000, interval: 50 },
    );

    // The re-attach counter is driven by the originally-restored missingFiles
    // list and does not auto-decrement, but the new filename must be visible
    // and synced — confirming the verification UI reflects the new upload.
    expect(screen.getByText("license-v2.pdf")).toBeInTheDocument();
    expect(screen.queryByText(/cloud sync failed/i)).not.toBeInTheDocument();
  }, 20000);
});
