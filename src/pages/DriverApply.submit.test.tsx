import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// --- Mocks ----------------------------------------------------------------

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-driver-submit", email: "driver@pickyou.test" },
    profile: null,
    loading: false,
  }),
}));

vi.mock("@/components/landing/LandingNav", () => ({ default: () => null }));
vi.mock("@/components/landing/LandingFooter", () => ({ default: () => null }));

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    error: (...a: any[]) => toastError(...a),
    success: (...a: any[]) => toastSuccess(...a),
  },
}));

const cloudStore = new Map<string, any>();
const upsertSpy = vi.fn();
const deleteSpy = vi.fn();

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
          deleteSpy(v);
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

async function advanceToStep3() {
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
  const pickyouRadio = document.getElementById("tier-pickyou")!;
  fireEvent.click(pickyouRadio.closest("label")!);
  fireEvent.change(screen.getByLabelText(/make/i), { target: { value: "Toyota" } });
  fireEvent.change(screen.getByLabelText(/model/i), { target: { value: "Camry" } });
  fireEvent.change(screen.getByLabelText(/year/i), {
    target: { value: String(MIN_VEHICLE_YEAR + 2) },
  });
  fireEvent.click(screen.getByRole("button", { name: /continue/i }));

  await screen.findByLabelText(/driver's license/i);
}

describe("DriverApply — Step 3 submission flips verification status from pending to submitted", () => {
  beforeEach(() => {
    cloudStore.clear();
    upsertSpy.mockClear();
    deleteSpy.mockClear();
    toastError.mockClear();
    toastSuccess.mockClear();
    localStorage.clear();
    sessionStorage.clear();
  });

  it("submits documents and renders the 'Application received' confirmation UI", async () => {
    renderPage();
    await advanceToStep3();

    // ---- PRE-SUBMIT (pending) ----
    // Step indicator should show "Step 3 of 4 · Documents" and the Submit
    // button should NOT yet be visible (Continue still controls flow).
    expect(screen.getByText(/step 3 of 4/i)).toBeInTheDocument();
    expect(screen.getByText(/^Documents$/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /submit application/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/application received/i)).not.toBeInTheDocument();

    // Attach the 3 required documents (PickYou tier — chauffeur permit optional).
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

    // Advance to the Review (Step 4) screen.
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    await screen.findByText(/review your application/i);
    expect(screen.getByText(/step 4 of 4/i)).toBeInTheDocument();

    // ---- SUBMIT ----
    const submitBtn = await screen.findByRole("button", {
      name: /submit application/i,
    });
    fireEvent.click(submitBtn);

    // ---- POST-SUBMIT (submitted) ----
    // The confirmation page must render with the exact "Application received"
    // heading and follow-up messaging confirming the email and 24h SLA.
    const heading = await screen.findByRole("heading", {
      name: /application received/i,
      level: 1,
    });
    expect(heading).toBeInTheDocument();
    expect(
      screen.getByText(/we'll review your application and get back to you within 24 hours/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/alex@example.com/)).toBeInTheDocument();

    // The post-submit screen must offer next-step CTAs.
    expect(
      screen.getByRole("button", { name: /create account/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /back to home/i })).toBeInTheDocument();

    // The multi-step form chrome (step indicator, Continue/Submit buttons,
    // Documents fields) must be gone — confirming the verification UI fully
    // transitioned out of the "pending" state.
    expect(screen.queryByText(/step \d of 4/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/driver's license/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /submit application/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^continue$/i }),
    ).not.toBeInTheDocument();
    expect(toastError).not.toHaveBeenCalled();

    // The submission must persist a lightweight summary for post-signup
    // onboarding prefill, and clear the cloud draft (verification handoff).
    await waitFor(() => {
      const stash = sessionStorage.getItem("pickyou.driver_apply_draft");
      expect(stash).toBeTruthy();
      const parsed = JSON.parse(stash!);
      expect(parsed.full_name).toBe("Alex Driver");
      expect(parsed.email).toBe("alex@example.com");
      expect(parsed.tier).toBe("pickyou");
      expect(parsed.vehicle).toEqual({
        make: "Toyota",
        model: "Camry",
        year: MIN_VEHICLE_YEAR + 2,
      });
      expect(typeof parsed.submitted_at).toBe("string");
    });

    await waitFor(() => {
      expect(deleteSpy).toHaveBeenCalledWith("user-driver-submit");
      expect(cloudStore.has("user-driver-submit")).toBe(false);
    });
  }, 15000);

  it("blocks submission with an error toast when required documents are missing", async () => {
    renderPage();
    await advanceToStep3();

    // Try to advance to Review without uploading any documents.
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    // Should remain on Step 3 with inline errors + an error toast.
    await waitFor(() => {
      expect(toastError).toHaveBeenCalled();
    });
    expect(screen.getByText(/driver's license is required/i)).toBeInTheDocument();
    expect(screen.getByText(/vehicle registration is required/i)).toBeInTheDocument();
    expect(screen.getByText(/proof of insurance is required/i)).toBeInTheDocument();
    // Verification status must NOT advance to "submitted".
    expect(screen.queryByText(/application received/i)).not.toBeInTheDocument();
    expect(screen.getByText(/step 3 of 4/i)).toBeInTheDocument();
  }, 10000);
});
