import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// --- Mocks ----------------------------------------------------------------

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-driver-1", email: "driver@pickyou.test" },
    profile: null,
    loading: false,
  }),
}));

vi.mock("@/components/landing/LandingNav", () => ({ default: () => null }));
vi.mock("@/components/landing/LandingFooter", () => ({ default: () => null }));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

// Shared in-memory "cloud" row keyed by applicant_user_id.
const cloudStore = new Map<string, any>();

// Track the last upsert so tests can assert on cloud writes.
const upsertSpy = vi.fn();

vi.mock("@/integrations/supabase/client", () => {
  const buildQuery = () => {
    const state: { userId?: string } = {};
    const api: any = {
      select: () => api,
      eq: (_col: string, val: string) => {
        state.userId = val;
        return api;
      },
      maybeSingle: async () => {
        const row = state.userId ? cloudStore.get(state.userId) : null;
        return { data: row ?? null, error: null };
      },
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
        eq: async (_col: string, val: string) => {
          cloudStore.delete(val);
          return { error: null };
        },
      }),
    };
    return api;
  };
  return {
    supabase: {
      from: (_table: string) => buildQuery(),
    },
  };
});

import DriverApply from "./DriverApply";

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/driver-apply"]}>
      <DriverApply />
    </MemoryRouter>,
  );

describe("DriverApply — draft persistence + cloud sync", () => {
  beforeEach(() => {
    cloudStore.clear();
    upsertSpy.mockClear();
    localStorage.clear();
    sessionStorage.clear();
  });

  it("auto-saves to the cloud, then restores draft and shows synced status after reload", async () => {
    // ---- First mount: enter data ----
    const { unmount } = renderPage();

    fireEvent.change(screen.getByLabelText(/full name/i), {
      target: { value: "Alex Driver" },
    });
    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: "alex@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/phone number/i), {
      target: { value: "(867) 555-0199" },
    });

    // Wait for the debounced (800ms) auto-save to upsert to "cloud".
    await waitFor(
      () => {
        expect(upsertSpy).toHaveBeenCalled();
      },
      { timeout: 3000 },
    );

    // The most recent upsert should contain the typed values.
    const lastCall = upsertSpy.mock.calls.at(-1)![0];
    expect(lastCall.applicant_user_id).toBe("user-driver-1");
    expect(lastCall.form.full_name).toBe("Alex Driver");
    expect(lastCall.form.email).toBe("alex@example.com");
    expect(lastCall.form.phone).toBe("(867) 555-0199");

    // Banner should reflect a successful cloud sync.
    await waitFor(() => {
      expect(screen.getByText(/synced to your account/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/draft auto-saved/i)).toBeInTheDocument();

    // ---- Simulate "reload" by unmounting and remounting ----
    unmount();
    cleanup();

    renderPage();

    // The draft should be restored from the mocked cloud store.
    await waitFor(() => {
      expect(
        (screen.getByLabelText(/full name/i) as HTMLInputElement).value,
      ).toBe("Alex Driver");
    });
    expect((screen.getByLabelText(/^email$/i) as HTMLInputElement).value).toBe(
      "alex@example.com",
    );
    expect(
      (screen.getByLabelText(/phone number/i) as HTMLInputElement).value,
    ).toBe("(867) 555-0199");

    // Restoration banner + cloud sync indicator should appear (no "Cloud sync failed").
    await waitFor(() => {
      expect(screen.getByText(/draft auto-saved/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/cloud sync failed/i)).not.toBeInTheDocument();
    // After restore the status idles at "synced" or transitions to "synced"
    // once the next auto-save fires; either way it must not be in the error state.
    await waitFor(() => {
      expect(screen.getByText(/synced to your account/i)).toBeInTheDocument();
    });
  }, 10000);
});
