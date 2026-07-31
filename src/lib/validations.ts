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

// A date string in YYYY-MM-DD form. The Excel import normalizes to this shape
// before validating; see src/lib/import/normalize.ts.
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

export type Company = z.infer<typeof companySchema>;
export type IssueType = z.infer<typeof issueTypeSchema>;
export type TicketStatus = z.infer<typeof ticketStatusSchema>;
export type TestCasePriority = z.infer<typeof testCasePrioritySchema>;
export type TestCaseStatus = z.infer<typeof testCaseStatusSchema>;
export type TicketInput = z.infer<typeof ticketInputSchema>;
export type TestCaseInput = z.infer<typeof testCaseInputSchema>;
