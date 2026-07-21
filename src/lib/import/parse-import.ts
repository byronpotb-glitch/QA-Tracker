import { z } from "zod";
import {
  importSchema,
  testCaseInputSchema,
  ticketInputSchema,
  type ImportPayload,
  type TestCaseInput,
  type TicketInput,
} from "@/lib/validations";

export interface FieldError {
  field: string;
  message: string;
}

export interface TestCaseRowPreview {
  index: number;
  data: Partial<TestCaseInput> & Record<string, unknown>;
  errors: FieldError[];
}

export interface ImportPreview {
  valid: boolean;
  ticket: {
    data: Partial<TicketInput> & Record<string, unknown>;
    errors: FieldError[];
  };
  testCases: TestCaseRowPreview[];
  /** Set when the JSON doesn't even have the right top-level shape. */
  formatError?: string;
  /** Only present when the whole payload validates cleanly. */
  data?: ImportPayload;
}

export function parseImportText(
  text: string
): { json: unknown } | { formatError: string } {
  try {
    return { json: JSON.parse(text) };
  } catch (err) {
    return {
      formatError:
        err instanceof Error ? `Invalid JSON: ${err.message}` : "Invalid JSON",
    };
  }
}

function issuesToFieldErrors(issues: z.ZodError["issues"]): FieldError[] {
  return issues.map((issue) => ({
    field: issue.path.join(".") || "(root)",
    message: issue.message,
  }));
}

export function buildImportPreview(json: unknown): ImportPreview {
  const fullResult = importSchema.safeParse(json);

  if (fullResult.success) {
    return {
      valid: true,
      data: fullResult.data,
      ticket: { data: fullResult.data.ticket, errors: [] },
      testCases: fullResult.data.test_cases.map((tc, index) => ({
        index,
        data: tc,
        errors: [],
      })),
    };
  }

  if (typeof json !== "object" || json === null || Array.isArray(json)) {
    return {
      valid: false,
      formatError: "Top-level JSON must be an object with \"ticket\" and \"test_cases\" keys.",
      ticket: { data: {}, errors: [] },
      testCases: [],
    };
  }

  const obj = json as Record<string, unknown>;

  const ticketData =
    typeof obj.ticket === "object" && obj.ticket !== null
      ? (obj.ticket as Record<string, unknown>)
      : {};
  // Re-check ticket in isolation so its own errors are scoped to it, not
  // polluted by test_cases issues.
  const ticketResult = ticketInputSchema.safeParse(ticketData);
  const ticketErrors = ticketResult.success
    ? []
    : ticketResult.error.issues.map((issue) => ({
        field: issue.path.join(".") || "(root)",
        message: issue.message,
      }));

  const rawTestCases = Array.isArray(obj.test_cases) ? obj.test_cases : [];

  let formatError: string | undefined;
  if (!Array.isArray(obj.test_cases)) {
    formatError = '"test_cases" must be an array.';
  } else if (rawTestCases.length === 0) {
    formatError = "At least one test case is required.";
  }

  const testCases: TestCaseRowPreview[] = rawTestCases.map((raw, index) => {
    const result = testCaseInputSchema.safeParse(raw);
    return {
      index,
      data: (typeof raw === "object" && raw !== null ? raw : {}) as Partial<TestCaseInput>,
      errors: result.success
        ? []
        : result.error.issues.map((issue) => ({
            field: issue.path.join(".") || "(root)",
            message: issue.message,
          })),
    };
  });

  return {
    valid: false,
    formatError,
    ticket: { data: ticketData, errors: ticketErrors },
    testCases,
  };
}

// Kept for API routes that just need a pass/fail without building row-level
// preview data (e.g. re-validating on submit).
export function validateImportPayload(
  json: unknown
):
  | { success: true; data: ImportPayload }
  | { success: false; errors: FieldError[] } {
  const result = importSchema.safeParse(json);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: issuesToFieldErrors(result.error.issues) };
}
