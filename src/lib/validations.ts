import { z } from "zod";

export const companySchema = z.enum(["POTB", "GLADEX"]);

export const issueTypeSchema = z.enum([
  "BUG",
  "FEATURE",
  "IMPROVEMENT",
  "CHANGE_REQUEST",
]);

export const ticketStatusSchema = z.enum([
  "PASSED",
  "FAILED",
  "IN_PROGRESS",
  "PENDING",
  "ON_HOLD",
]);

export const testCasePrioritySchema = z.enum(["HIGH", "MEDIUM", "LOW"]);

export const testCaseStatusSchema = z.enum([
  "PASSED",
  "FAILED",
  "IN_PROGRESS",
  "PENDING",
  "ON_HOLD",
  "NOT_TESTED",
]);

// A date string in YYYY-MM-DD form, as produced by the AI workflow's JSON.
const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be a date in YYYY-MM-DD format");

export const ticketInputSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  company: companySchema,
  system: z.string().trim().min(1, "System is required"),
  module: z.string().trim().min(1, "Module is required"),
  issue_type: issueTypeSchema,
  tester: z.string().trim().min(1, "Tester is required"),
  dev: z.string().trim().min(1).optional(),
  // Optional: for backfilling historical tickets whose status/retry count
  // are already known (e.g. a prior spreadsheet), rather than letting the
  // normal rollup compute them from the imported test cases. When either is
  // present, the ticket is created with manualOverride=true so the rollup
  // never overwrites this frozen historical value.
  ticket_status: ticketStatusSchema.optional(),
  failed_counter: z.number().int().min(0).optional(),
});

export const testCaseInputSchema = z.object({
  tc_number: z.string().trim().min(1, "TC number is required"),
  page: z.string().trim().min(1, "Page is required"),
  description: z.string().trim().min(1, "Description is required"),
  priority: testCasePrioritySchema,
  expected_result: z.string().trim().min(1, "Expected result is required"),
  actual_result: z.string().trim().nullable().optional(),
  comments: z.string().trim().nullable().optional(),
  status: testCaseStatusSchema,
  tested_date: dateStringSchema.nullable().optional(),
});

// This is the JSON import contract — the shape the AI workflow generates and
// pastes into the Import page. Do not change field names/shapes without
// checking with the user first; it's a contract with an external process.
export const importSchema = z.object({
  ticket: ticketInputSchema,
  test_cases: z.array(testCaseInputSchema).min(1, "At least one test case is required"),
});

export type Company = z.infer<typeof companySchema>;
export type IssueType = z.infer<typeof issueTypeSchema>;
export type TicketStatus = z.infer<typeof ticketStatusSchema>;
export type TestCasePriority = z.infer<typeof testCasePrioritySchema>;
export type TestCaseStatus = z.infer<typeof testCaseStatusSchema>;
export type TicketInput = z.infer<typeof ticketInputSchema>;
export type TestCaseInput = z.infer<typeof testCaseInputSchema>;
export type ImportPayload = z.infer<typeof importSchema>;
