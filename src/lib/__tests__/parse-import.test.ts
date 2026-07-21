import { describe, expect, it } from "vitest";
import {
  buildImportPreview,
  parseImportText,
  validateImportPayload,
} from "@/lib/import/parse-import";

const validPayload = {
  ticket: {
    title: "FIX PARTNER DROPDOWN (MEILISEARCH QUERY ON INIT)",
    company: "POTB",
    system: "LakbayHub/POTB",
    module: "Partner Management",
    issue_type: "BUG_FIX",
    tester: "Byron",
  },
  test_cases: [
    {
      tc_number: "TC001",
      page: "Booking - Partner Dropdown",
      description: "Verify partner dropdown loads correctly on page init.",
      priority: "HIGH",
      expected_result: "Dropdown populates immediately on page load.",
      actual_result: "Dropdown populated correctly on init.",
      comments: "Core fix confirmed working.",
      status: "PASSED",
      tested_date: "2026-07-09",
    },
  ],
};

describe("parseImportText", () => {
  it("parses valid JSON", () => {
    const result = parseImportText(JSON.stringify(validPayload));
    expect("json" in result).toBe(true);
  });

  it("reports a format error for malformed JSON", () => {
    const result = parseImportText("{ not valid json");
    expect("formatError" in result).toBe(true);
  });
});

describe("validateImportPayload", () => {
  it("accepts the documented import shape", () => {
    const result = validateImportPayload(validPayload);
    expect(result.success).toBe(true);
  });

  it("rejects an unknown company", () => {
    const result = validateImportPayload({
      ...validPayload,
      ticket: { ...validPayload.ticket, company: "ACME" },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.field === "ticket.company")).toBe(
        true
      );
    }
  });

  it("rejects an empty test_cases array", () => {
    const result = validateImportPayload({ ...validPayload, test_cases: [] });
    expect(result.success).toBe(false);
  });

  it("rejects a missing required field", () => {
    const { description: _description, ...rest } = validPayload.test_cases[0];
    const result = validateImportPayload({
      ...validPayload,
      test_cases: [rest],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.errors.some((e) => e.field === "test_cases.0.description")
      ).toBe(true);
    }
  });

  it("rejects a malformed tested_date", () => {
    const result = validateImportPayload({
      ...validPayload,
      test_cases: [
        { ...validPayload.test_cases[0], tested_date: "07/09/2026" },
      ],
    });
    expect(result.success).toBe(false);
  });
});

describe("buildImportPreview", () => {
  it("marks a valid payload as valid with no errors", () => {
    const preview = buildImportPreview(validPayload);
    expect(preview.valid).toBe(true);
    expect(preview.ticket.errors).toHaveLength(0);
    expect(preview.testCases[0].errors).toHaveLength(0);
  });

  it("still returns all rows for preview when one row is invalid", () => {
    const preview = buildImportPreview({
      ...validPayload,
      test_cases: [
        validPayload.test_cases[0],
        { ...validPayload.test_cases[0], tc_number: "TC002", priority: "URGENT" },
      ],
    });
    expect(preview.valid).toBe(false);
    expect(preview.testCases).toHaveLength(2);
    expect(preview.testCases[0].errors).toHaveLength(0);
    expect(preview.testCases[1].errors.length).toBeGreaterThan(0);
    expect(preview.testCases[1].errors[0].field).toBe("priority");
  });

  it("surfaces ticket-level errors independently of test case errors", () => {
    const preview = buildImportPreview({
      ticket: { ...validPayload.ticket, company: "ACME" },
      test_cases: validPayload.test_cases,
    });
    expect(preview.ticket.errors.some((e) => e.field === "company")).toBe(
      true
    );
    expect(preview.testCases[0].errors).toHaveLength(0);
  });

  it("reports a formatError when top-level JSON is the wrong shape", () => {
    const preview = buildImportPreview(["not", "an", "object"]);
    expect(preview.valid).toBe(false);
    expect(preview.formatError).toBeDefined();
  });

  it("reports a formatError when test_cases is missing/not an array", () => {
    const preview = buildImportPreview({ ticket: validPayload.ticket });
    expect(preview.valid).toBe(false);
    expect(preview.formatError).toMatch(/test_cases/);
  });
});
