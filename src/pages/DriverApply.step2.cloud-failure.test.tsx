import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// --- Mocks ----------------------------------------------------------------

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-driver-step2-failure", email: "driver@pickyou.test" },
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

// Switchable failure modes for the mocked Supabase client.
const cloudState: {
  failUpsert: boolean;
  failSelect: "none" | "throw" | "error";
  upsertCalls: number;
  selectCalls: number;
  store: Map<string, any>;
} = {
  failUpsert: false,
  failSelect: "none",
  upsertCalls: 0,
  selectCalls: 0,
  store: new Map(),
};

vi.mock("@/integrations/supabase/client", () => {
  const buildQuery = () => {
    const state: { userId?: string } = {};
    const api: any = {
      select: () => api,
      eq: (_c: string, v: string) => {
        state.userId = v;
        return api;
      },
      maybeSingle: async () => {
        cloudState.selectCalls += 1;
        if (cloudState.failSelect === "throw") {
          throw new Error("network down");
        }
        if (cloudState.failSelect === "error") {
          return {
            data: null,
            error: { message: "select failed", code: "PGRST500" } as any,
          };
        }
        return {
          data: state.userId ? cloudState.store.get(state.userId) ?? null : null,
          error: null,
        };
      },
      upsert: async (row: any) => {
        cloudState.upsertCalls += 1;
        if (cloudState.failUpsert) {
          return { error: { message: "upsert failed", code: "PGRST500" } as any };
        }
        cloudState.store.set(row.applicant_user_id, {
          step: row.step,
          form: row.form,
          file_names: row.file_names,
          saved_at: row.saved_at,
        });
        return { error: null };
      },
      delete: () => ({
        eq: async (_c: string, v: string) => {
          cloudState.store.delete(v);
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

async function fillStepOneAndAdvance() {
  const fullName = await screen.findByLabelText(/full name/i);
  // Wait for the async restore effect before typing.
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
}

describe("DriverApply — Step 2 cloud failure handling", () => {
  beforeEach(() => {
    cloudState.failUpsert = false;
    cloudState.failSelect = "none";
    cloudState.upsertCalls = 0;
    cloudState.selectCalls = 0;
    cloudState.store.clear();
    toastError.mockClear();
    toastSuccess.mockClear();
    localStorage.clear();
    sessionStorage.clear();
  });

  it("shows the inline 'Cloud sync failed' error on Step 2 when the Supabase upsert fails, and keeps the user on the Vehicle & Tier screen", async () => {
    cloudState.failUpsert = true;

    renderPage();
    await fillStepOneAndAdvance();

    // Fill Step 2 with valid data — this triggers the debounced cloud upsert
    // which is mocked to fail.
    fireEvent.click(document.getElementById("tier-pickyou")!.closest("label")!);
    fireEvent.change(screen.getByLabelText(/make/i), { target: { value: "Toyota" } });
    fireEvent.change(screen.getByLabelText(/model/i), { target: { value: "Camry" } });
    fireEvent.change(screen.getByLabelText(/year/i), {
      target: { value: String(MIN_VEHICLE_YEAR + 2) },
    });

    // The auto-save effect runs the upsert which returns { error: ... } →
    // setCloudSync("error") → "Cloud sync failed" appears inline in the
    // draft-status banner.
    await waitFor(
      () => {
        expect(screen.getByText(/cloud sync failed/i)).toBeInTheDocument();
      },
      { timeout: 5000, interval: 50 },
    );

    // The "Synced to your account" badge MUST NOT be visible in the failure state.
    expect(screen.queryByText(/synced to your account/i)).not.toBeInTheDocument();

    // The cloud upsert was attempted at least once.
    expect(cloudState.upsertCalls).toBeGreaterThan(0);
    // ...but nothing was actually persisted to the cloud store on failure.
    expect(cloudState.store.has("user-driver-step2-failure")).toBe(false);

    // Local draft must still have been written as a fallback so the user
    // doesn't lose progress when the cloud is down.
    const localDraft = localStorage.getItem("pickyou.driver_apply_draft.v1");
    expect(localDraft).not.toBeNull();
    const parsed = JSON.parse(localDraft!);
    expect(parsed.step).toBe(1);
    expect(parsed.form.tier).toBe("pickyou");
    expect(parsed.form.vehicle_make).toBe("Toyota");
    expect(parsed.form.vehicle_model).toBe("Camry");

    // CRITICAL: the user must remain on Step 2 — the cloud failure must not
    // bounce them off the screen or auto-advance.
    expect(screen.getByText(/step 2 of 4/i)).toBeInTheDocument();
    expect(
      screen.getByText(/which tier are you applying for\?/i),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/driver's license/i)).not.toBeInTheDocument();

    // Step 2 inputs remain editable and Continue is still actionable. Filling
    // valid data and clicking Continue should still advance — the cloud
    // failure must not block the user from progressing locally.
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    await screen.findByLabelText(/driver's license/i);
  }, 15000);

  it("falls back gracefully when the Supabase draft retrieve throws on reload, keeping the user on Step 2 via the local draft", async () => {
    // First mount: succeed normally so the user advances to Step 2 and the
    // local draft is populated.
    const { unmount } = renderPage();
    await fillStepOneAndAdvance();

    fireEvent.click(document.getElementById("tier-pickyou")!.closest("label")!);
    fireEvent.change(screen.getByLabelText(/make/i), { target: { value: "Honda" } });
    fireEvent.change(screen.getByLabelText(/model/i), { target: { value: "Civic" } });
    fireEvent.change(screen.getByLabelText(/year/i), {
      target: { value: String(MIN_VEHICLE_YEAR + 3) },
    });

    // Wait for cloud sync to succeed and for local draft to be written.
    await waitFor(
      () => {
        expect(cloudState.store.get("user-driver-step2-failure")?.step).toBe(1);
        expect(localStorage.getItem("pickyou.driver_apply_draft.v1")).not.toBeNull();
      },
      { timeout: 5000, interval: 50 },
    );

    // ---- Simulate reload with the cloud SELECT throwing ----
    unmount();
    cleanup();
    toastError.mockClear();
    toastSuccess.mockClear();
    cloudState.failSelect = "throw";
    const selectCallsBefore = cloudState.selectCalls;

    renderPage();

    // The restore effect should attempt the cloud read once...
    await waitFor(
      () => {
        expect(cloudState.selectCalls).toBeGreaterThan(selectCallsBefore);
      },
      { timeout: 5000, interval: 50 },
    );

    // ...catch the thrown error, and fall back to the local draft. The
    // restored toast description should reflect the LOCAL source.
    await screen.findByText(/draft auto-saved/i, undefined, { timeout: 5000 });
    expect(toastSuccess).toHaveBeenCalled();
    const restoreToastArgs = toastSuccess.mock.calls.find(([msg]) =>
      typeof msg === "string" && /draft restored from this device/i.test(msg),
    );
    expect(restoreToastArgs).toBeTruthy();

    // CRITICAL: even with the cloud retrieve failing, the user must land on
    // Step 2 (not bounced to Step 1) with all their Step 2 data restored
    // from the local draft fallback.
    await screen.findByText(/which tier are you applying for\?/i);
    expect(screen.getByText(/step 2 of 4/i)).toBeInTheDocument();

    expect((screen.getByLabelText(/make/i) as HTMLInputElement).value).toBe("Honda");
    expect((screen.getByLabelText(/model/i) as HTMLInputElement).value).toBe("Civic");
    expect((screen.getByLabelText(/year/i) as HTMLInputElement).value).toBe(
      String(MIN_VEHICLE_YEAR + 3),
    );
    expect(
      document.getElementById("tier-pickyou")!.getAttribute("aria-checked"),
    ).toBe("true");

    // The user must NOT have been kicked to the success screen or to Step 3.
    expect(screen.queryByText(/application received/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/driver's license/i)).not.toBeInTheDocument();
  }, 15000);

  it("falls back to the local draft and keeps the user on Step 2 when the Supabase draft retrieve returns an error response on reload", async () => {
    // Seed local draft via a successful first mount.
    const { unmount } = renderPage();
    await fillStepOneAndAdvance();

    fireEvent.click(document.getElementById("tier-taxi")!.closest("label")!);
    fireEvent.change(screen.getByLabelText(/make/i), { target: { value: "Ford" } });
    fireEvent.change(screen.getByLabelText(/model/i), { target: { value: "Escape" } });
    fireEvent.change(screen.getByLabelText(/year/i), {
      target: { value: String(MIN_VEHICLE_YEAR + 5) },
    });

    await waitFor(
      () => {
        expect(localStorage.getItem("pickyou.driver_apply_draft.v1")).not.toBeNull();
      },
      { timeout: 5000, interval: 50 },
    );

    // ---- Reload with cloud SELECT returning { error } (non-throw path) ----
    unmount();
    cleanup();
    toastError.mockClear();
    toastSuccess.mockClear();
    cloudState.failSelect = "error";

    renderPage();

    // Restore effect should fall back to local since `error` is truthy.
    await screen.findByText(/draft auto-saved/i, undefined, { timeout: 5000 });
    await screen.findByText(/which tier are you applying for\?/i);
    expect(screen.getByText(/step 2 of 4/i)).toBeInTheDocument();

    // Local-fallback restoration values intact.
    expect((screen.getByLabelText(/make/i) as HTMLInputElement).value).toBe("Ford");
    expect((screen.getByLabelText(/model/i) as HTMLInputElement).value).toBe(
      "Escape",
    );
    expect(
      document.getElementById("tier-taxi")!.getAttribute("aria-checked"),
    ).toBe("true");

    // Toast was the local-source variant.
    const localToast = toastSuccess.mock.calls.find(([msg]) =>
      typeof msg === "string" && /draft restored from this device/i.test(msg),
    );
    expect(localToast).toBeTruthy();

    // No cloud-error banner is shown by the restore path itself — the
    // cloudSync state stays "idle" until the next debounced save runs.
    expect(screen.queryByText(/cloud sync failed/i)).not.toBeInTheDocument();
  }, 15000);
});
