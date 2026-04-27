import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// --- Mocks ----------------------------------------------------------------

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1", email: "jane@acme.com" },
    profile: { user_id: "user-1", full_name: "Jane Doe" },
    loading: false,
  }),
}));

// supabase client: organization_applications query returns no existing app.
vi.mock("@/integrations/supabase/client", () => {
  return {
    supabase: {
      from: () => ({
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: () => ({
                maybeSingle: async () => ({ data: null, error: null }),
              }),
            }),
          }),
        }),
        insert: async () => ({ error: null }),
      }),
      functions: { invoke: async () => ({ data: null, error: null }) },
    },
  };
});

// Toast — capture error calls so we can assert the summary toast.
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { error: (...args: any[]) => toastError(...args), success: vi.fn() },
}));

// framer-motion: render <motion.*> as a plain element in jsdom.
vi.mock("framer-motion", () => {
  const React = require("react");
  const make = (tag: string) =>
    React.forwardRef((props: any, ref: any) => React.createElement(tag, { ...props, ref }));
  return {
    motion: new Proxy({} as any, { get: (_t, key: string) => make(key) }),
    AnimatePresence: ({ children }: any) => children,
  };
});

// --- Test setup -----------------------------------------------------------

import BusinessApply from "./BusinessApply";

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/corporate-apply"]}>
        <BusinessApply />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  toastError.mockClear();
});

// --- Tests ----------------------------------------------------------------

describe("/corporate-apply — inline validation UI", () => {
  it("shows the exact inline error next to each field for invalid input", async () => {
    renderPage();

    // Wait for the form to render (skeleton hidden once auth+query resolve).
    const submit = await screen.findByRole("button", { name: /submit application/i });

    // Fill the form with deliberately invalid values.
    const setValue = (id: string, value: string) => {
      const el = document.getElementById(id) as HTMLInputElement;
      expect(el).toBeTruthy();
      fireEvent.change(el, { target: { value } });
    };

    setValue("company_name", "A"); // too short
    setValue("billing_email", "not-an-email"); // invalid email
    setValue("contact_person_name", ""); // required, blank
    setValue("contact_person_email", "jane@"); // invalid email
    setValue("phone", "abc"); // bad phone
    setValue("payment_terms_requested", "1"); // below min 7

    const submit2 = screen.getByRole("button", { name: /submit application/i });
    console.log("SAME BUTTON?", submit === submit2);
    console.log("BUTTON DISABLED?", (submit2 as HTMLButtonElement).disabled);
    await act(async () => {
      (submit2 as HTMLButtonElement).click();
      await new Promise((r) => setTimeout(r, 50));
    });
    const errEls = document.querySelectorAll('[id$="-error"]');
    console.log("ERROR ELEMENTS:", errEls.length, Array.from(errEls).map(e => e.id));
    console.log("TOAST CALLS:", toastError.mock.calls.length);

    // Each error should appear inline, with id "<field>-error".
    await waitFor(
      () => {
        expect(document.getElementById("company_name-error")).toBeTruthy();
      },
      { timeout: 3000 },
    );

    const expectError = (fieldId: string, expected: string) => {
      const el = document.getElementById(`${fieldId}-error`);
      expect(el, `missing inline error for ${fieldId}`).toBeTruthy();
      expect(el!.textContent?.trim()).toBe(expected);
      // Field input should also be marked aria-invalid.
      const input = document.getElementById(fieldId) as HTMLElement;
      expect(input.getAttribute("aria-invalid")).toBe("true");
    };

    expectError("company_name", "Company name must be at least 2 characters");
    expectError("billing_email", "Enter a valid billing email");
    expectError("contact_person_name", "Contact name must be at least 2 characters");
    expectError("contact_person_email", "Enter a valid contact email");
    expectError("phone", "Enter a valid phone number");
    expectError("payment_terms_requested", "Minimum 7 days");

    // Summary banner is shown.
    const alerts = screen.getAllByRole("alert");
    expect(
      alerts.some((a) => /correct the highlighted fields/i.test(a.textContent ?? "")),
    ).toBe(true);

    // Error toast was triggered.
    expect(toastError).toHaveBeenCalledWith(
      "Please fix the highlighted fields before submitting.",
    );
  });

  it("clears a field's inline error as soon as the user edits it", async () => {
    renderPage();
    const submit = await screen.findByRole("button", { name: /submit application/i });

    fireEvent.click(submit); // submit empty form to trigger errors

    await waitFor(() => {
      expect(document.getElementById("company_name-error")).toBeTruthy();
    });

    const company = document.getElementById("company_name") as HTMLInputElement;
    fireEvent.change(company, { target: { value: "Acme Industries" } });

    await waitFor(() => {
      expect(document.getElementById("company_name-error")).toBeNull();
    });
  });
});
