import { describe, it, expect } from "vitest";
import { z } from "zod";

// Re-declared schema mirrors the one in BusinessApply.tsx. If the schema
// changes there, update here so this guards the user-visible error copy.
const phoneRegex = /^[+\d][\d\s\-().]{6,}$/;

const applicationSchema = z.object({
  company_name: z.string().trim()
    .min(2, { message: "Company name must be at least 2 characters" })
    .max(120, { message: "Company name must be 120 characters or fewer" }),
  registration_number: z.string().trim()
    .max(60, { message: "Registration number must be 60 characters or fewer" })
    .optional().or(z.literal("")),
  billing_email: z.string().trim()
    .email({ message: "Enter a valid billing email" })
    .max(255, { message: "Email must be 255 characters or fewer" }),
  accounts_payable_email: z.string().trim()
    .max(255, { message: "Email must be 255 characters or fewer" })
    .email({ message: "Enter a valid email" })
    .optional().or(z.literal("")),
  phone: z.string().trim()
    .regex(phoneRegex, { message: "Enter a valid phone number" })
    .max(40, { message: "Phone number is too long" })
    .optional().or(z.literal("")),
  address: z.string().trim()
    .max(255, { message: "Address must be 255 characters or fewer" })
    .optional().or(z.literal("")),
  contact_person_name: z.string().trim()
    .min(2, { message: "Contact name must be at least 2 characters" })
    .max(120, { message: "Contact name must be 120 characters or fewer" }),
  contact_person_email: z.string().trim()
    .email({ message: "Enter a valid contact email" })
    .max(255, { message: "Email must be 255 characters or fewer" }),
  estimated_monthly_spend_cents: z.number({ invalid_type_error: "Enter a number" })
    .int().min(0, { message: "Cannot be negative" })
    .max(10_000_000_00, { message: "Value is too large" }),
  requested_credit_limit_cents: z.number({ invalid_type_error: "Enter a number" })
    .int().min(0, { message: "Cannot be negative" })
    .max(10_000_000_00, { message: "Value is too large" }),
  payment_terms_requested: z.number({ invalid_type_error: "Enter a number" })
    .int().min(7, { message: "Minimum 7 days" })
    .max(90, { message: "Maximum 90 days" }),
});

const validForm = {
  company_name: "Acme Industries",
  registration_number: "",
  billing_email: "billing@acme.com",
  accounts_payable_email: "",
  phone: "",
  address: "",
  contact_person_name: "Jane Doe",
  contact_person_email: "jane@acme.com",
  estimated_monthly_spend_cents: 100000,
  requested_credit_limit_cents: 500000,
  payment_terms_requested: 30,
};

function errorsFor(input: any): Record<string, string> {
  const result = applicationSchema.safeParse(input);
  if (result.success) return {};
  const errs: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? "_");
    if (!errs[key]) errs[key] = issue.message;
  }
  return errs;
}

describe("BusinessApply validation schema", () => {
  it("accepts a fully valid application payload", () => {
    expect(applicationSchema.safeParse(validForm).success).toBe(true);
  });

  describe("required text fields", () => {
    it("flags missing/short company name with the correct message", () => {
      expect(errorsFor({ ...validForm, company_name: "" }).company_name)
        .toBe("Company name must be at least 2 characters");
      expect(errorsFor({ ...validForm, company_name: "A" }).company_name)
        .toBe("Company name must be at least 2 characters");
    });

    it("flags overlong company name", () => {
      expect(errorsFor({ ...validForm, company_name: "x".repeat(121) }).company_name)
        .toBe("Company name must be 120 characters or fewer");
    });

    it("flags short contact name", () => {
      expect(errorsFor({ ...validForm, contact_person_name: "" }).contact_person_name)
        .toBe("Contact name must be at least 2 characters");
    });
  });

  describe("email fields", () => {
    it("flags invalid billing email", () => {
      expect(errorsFor({ ...validForm, billing_email: "not-an-email" }).billing_email)
        .toBe("Enter a valid billing email");
    });

    it("flags invalid contact email", () => {
      expect(errorsFor({ ...validForm, contact_person_email: "jane@" }).contact_person_email)
        .toBe("Enter a valid contact email");
    });

    it("allows empty optional accounts_payable_email", () => {
      expect(errorsFor({ ...validForm, accounts_payable_email: "" }).accounts_payable_email)
        .toBeUndefined();
    });

    it("flags invalid optional accounts_payable_email when provided", () => {
      expect(errorsFor({ ...validForm, accounts_payable_email: "nope" }).accounts_payable_email)
        .toBe("Enter a valid email");
    });
  });

  describe("optional phone", () => {
    it("allows empty phone", () => {
      expect(errorsFor({ ...validForm, phone: "" }).phone).toBeUndefined();
    });

    it("flags malformed phone with the correct message", () => {
      expect(errorsFor({ ...validForm, phone: "abc" }).phone)
        .toBe("Enter a valid phone number");
    });

    it("accepts a well-formed phone number", () => {
      expect(errorsFor({ ...validForm, phone: "+1 (867) 988-8836" }).phone)
        .toBeUndefined();
    });
  });

  describe("numeric fields", () => {
    it("flags negative monthly spend", () => {
      expect(errorsFor({ ...validForm, estimated_monthly_spend_cents: -1 }).estimated_monthly_spend_cents)
        .toBe("Cannot be negative");
    });

    it("flags non-numeric monthly spend", () => {
      expect(errorsFor({ ...validForm, estimated_monthly_spend_cents: "abc" as any }).estimated_monthly_spend_cents)
        .toBe("Enter a number");
    });

    it("flags negative requested credit limit", () => {
      expect(errorsFor({ ...validForm, requested_credit_limit_cents: -100 }).requested_credit_limit_cents)
        .toBe("Cannot be negative");
    });

    it("enforces payment terms minimum of 7 days", () => {
      expect(errorsFor({ ...validForm, payment_terms_requested: 6 }).payment_terms_requested)
        .toBe("Minimum 7 days");
    });

    it("enforces payment terms maximum of 90 days", () => {
      expect(errorsFor({ ...validForm, payment_terms_requested: 91 }).payment_terms_requested)
        .toBe("Maximum 90 days");
    });

    it("accepts payment terms at the boundaries", () => {
      expect(applicationSchema.safeParse({ ...validForm, payment_terms_requested: 7 }).success).toBe(true);
      expect(applicationSchema.safeParse({ ...validForm, payment_terms_requested: 90 }).success).toBe(true);
    });
  });

  it("returns inline errors for multiple invalid fields at once", () => {
    const errs = errorsFor({
      ...validForm,
      company_name: "",
      billing_email: "bad",
      payment_terms_requested: 1,
    });
    expect(errs.company_name).toBe("Company name must be at least 2 characters");
    expect(errs.billing_email).toBe("Enter a valid billing email");
    expect(errs.payment_terms_requested).toBe("Minimum 7 days");
  });
});
