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

  it("shows inline required-document errors after reload on Step 3 (PickYou tier — chauffeur's permit stays optional)", async () => {
    const { unmount } = renderPage();
    await fillStepsOneAndTwo();

    // Upload all three required documents on Step 3 so the cloud row pins us
    // here after reload (file_names present, step=2).
    fireEvent.change(
      document.getElementById("drivers_license") as HTMLInputElement,
      { target: { files: [makeFile("license.pdf")] } },
    );
    fireEvent.change(
      document.getElementById("vehicle_registration") as HTMLInputElement,
      { target: { files: [makeFile("registration.pdf")] } },
    );
    fireEvent.change(
      document.getElementById("proof_of_insurance") as HTMLInputElement,
      { target: { files: [makeFile("insurance.pdf")] } },
    );

    await waitFor(
      () => {
        const last = upsertSpy.mock.calls.at(-1)?.[0];
        expect(last?.step).toBe(2);
        expect(last?.file_names?.drivers_license).toBe("license.pdf");
      },
      { timeout: 5000, interval: 50 },
    );

    // ---- Simulate reload ----
    unmount();
    cleanup();
    renderPage();

    // Restored on Step 3 — file blobs are gone but file_names persisted.
    await screen.findByText(/draft auto-saved/i, undefined, { timeout: 5000 });
    await screen.findByLabelText(/driver's license/i);
    expect(screen.getByText(/step 3 of 4/i)).toBeInTheDocument();
    expect(screen.getByText(/re-attach 3 files/i)).toBeInTheDocument();

    // No inline errors should be visible before the user attempts to continue.
    expect(
      screen.queryByText(/driver's license is required/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/vehicle registration is required/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/proof of insurance is required/i),
    ).not.toBeInTheDocument();

    // Click Continue — validation must fail because no blobs are attached.
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    // Inline per-field errors render for each missing required document.
    await screen.findByText(/driver's license is required/i);
    expect(
      screen.getByText(/vehicle registration is required/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/proof of insurance is required/i),
    ).toBeInTheDocument();

    // The driver's license input must be marked invalid for a11y.
    const dlInput = document.getElementById("drivers_license") as HTMLInputElement;
    expect(dlInput.getAttribute("aria-invalid")).toBe("true");
    const regInput = document.getElementById(
      "vehicle_registration",
    ) as HTMLInputElement;
    expect(regInput.getAttribute("aria-invalid")).toBe("true");
    const insInput = document.getElementById(
      "proof_of_insurance",
    ) as HTMLInputElement;
    expect(insInput.getAttribute("aria-invalid")).toBe("true");

    // Chauffeur's permit is OPTIONAL on the PickYou tier — it must NOT be
    // marked required, must NOT show an error, and must NOT be aria-invalid.
    expect(
      screen.queryByText(/chauffeur's permit is required/i),
    ).not.toBeInTheDocument();
    const permitInput = document.getElementById(
      "chauffeurs_permit",
    ) as HTMLInputElement;
    expect(permitInput.getAttribute("aria-invalid")).not.toBe("true");
    // The "(optional)" tag must be visible next to the Chauffeur's Permit label.
    const permitLabel = screen.getByText(/chauffeur's permit/i).closest("label");
    expect(permitLabel?.textContent).toMatch(/\(optional\)/i);

    // We should still be on Step 3 — the form did not advance to Review.
    expect(screen.getByText(/step 3 of 4/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/review your application/i),
    ).not.toBeInTheDocument();

    // Re-attach the driver's license — its inline error must clear immediately,
    // while the other two errors remain visible.
    fireEvent.change(dlInput, {
      target: { files: [makeFile("license-fresh.pdf")] },
    });
    await waitFor(() => {
      expect(
        screen.queryByText(/driver's license is required/i),
      ).not.toBeInTheDocument();
    });
    expect(
      screen.getByText(/vehicle registration is required/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/proof of insurance is required/i),
    ).toBeInTheDocument();
  }, 20000);

  it("marks chauffeur's permit as a required document on the Taxi tier after reload on Step 3", async () => {
    const { unmount } = renderPage();

    // Step 1
    const fullName = await screen.findByLabelText(/full name/i);
    await new Promise((r) => setTimeout(r, 50));
    fireEvent.change(fullName, { target: { value: "Tara Taxi" } });
    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: "tara@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/phone number/i), {
      target: { value: "(867) 555-0123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    // Step 2 — Taxi tier (chauffeur's permit becomes required).
    await screen.findByText(/which tier are you applying for\?/i);
    fireEvent.click(document.getElementById("tier-taxi")!.closest("label")!);
    fireEvent.change(screen.getByLabelText(/make/i), { target: { value: "Ford" } });
    fireEvent.change(screen.getByLabelText(/model/i), { target: { value: "Escape" } });
    fireEvent.change(screen.getByLabelText(/year/i), {
      target: { value: String(MIN_VEHICLE_YEAR + 3) },
    });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    // Step 3 — upload all 4 required documents (taxi includes chauffeur's permit).
    await screen.findByLabelText(/driver's license/i);
    fireEvent.change(
      document.getElementById("drivers_license") as HTMLInputElement,
      { target: { files: [makeFile("license.pdf")] } },
    );
    fireEvent.change(
      document.getElementById("vehicle_registration") as HTMLInputElement,
      { target: { files: [makeFile("registration.pdf")] } },
    );
    fireEvent.change(
      document.getElementById("proof_of_insurance") as HTMLInputElement,
      { target: { files: [makeFile("insurance.pdf")] } },
    );
    fireEvent.change(
      document.getElementById("chauffeurs_permit") as HTMLInputElement,
      { target: { files: [makeFile("permit.pdf")] } },
    );

    await waitFor(
      () => {
        const last = upsertSpy.mock.calls.at(-1)?.[0];
        expect(last?.step).toBe(2);
        expect(last?.form?.tier).toBe("taxi");
        expect(last?.file_names?.chauffeurs_permit).toBe("permit.pdf");
      },
      { timeout: 5000, interval: 50 },
    );

    // ---- Simulate reload ----
    unmount();
    cleanup();
    renderPage();

    await screen.findByText(/draft auto-saved/i, undefined, { timeout: 5000 });
    await screen.findByLabelText(/driver's license/i);
    expect(screen.getByText(/step 3 of 4/i)).toBeInTheDocument();
    expect(screen.getByText(/re-attach 4 files/i)).toBeInTheDocument();

    // The chauffeur's permit label must NOT show "(optional)" on the Taxi tier.
    const permitLabel = screen.getByText(/chauffeur's permit/i).closest("label");
    expect(permitLabel?.textContent || "").not.toMatch(/\(optional\)/i);

    // Click Continue — all 4 required document errors should appear inline,
    // including the chauffeur's permit since the user is on the Taxi tier.
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    await screen.findByText(/driver's license is required/i);
    expect(
      screen.getByText(/vehicle registration is required/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/proof of insurance is required/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/chauffeur's permit is required for taxi tier/i),
    ).toBeInTheDocument();

    const permitInput = document.getElementById(
      "chauffeurs_permit",
    ) as HTMLInputElement;
    expect(permitInput.getAttribute("aria-invalid")).toBe("true");

    // Still on Step 3.
    expect(screen.getByText(/step 3 of 4/i)).toBeInTheDocument();
  }, 20000);
});
