import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  boolean,
  date,
  timestamp,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const companyEnum = pgEnum("company", ["POTB", "GLADEX"]);

export const issueTypeEnum = pgEnum("issue_type", [
  "BUG",
  "FEATURE",
  "IMPROVEMENT",
  "CHANGE_REQUEST",
]);

// Ticket-level status: no NOT_TESTED, since a ticket only reaches PASSED
// once every test case has left NOT_TESTED behind.
export const ticketStatusEnum = pgEnum("ticket_status", [
  "PASSED",
  "FAILED",
  "IN_PROGRESS",
  "PENDING",
  "ON_HOLD",
]);

export const testCasePriorityEnum = pgEnum("test_case_priority", [
  "HIGH",
  "MEDIUM",
  "LOW",
]);

export const testCaseStatusEnum = pgEnum("test_case_status", [
  "PASSED",
  "FAILED",
  "IN_PROGRESS",
  "PENDING",
  "ON_HOLD",
  "NOT_TESTED",
]);

export const tickets = pgTable("tickets", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  company: companyEnum("company").notNull(),
  system: text("system").notNull(),
  module: text("module").notNull(),
  issueType: issueTypeEnum("issue_type").notNull(),
  ticketStatus: ticketStatusEnum("ticket_status").notNull().default("PENDING"),
  // When true, rollup computation must not overwrite ticketStatus.
  // Toggled off in the UI to resume automatic rollup.
  manualOverride: boolean("manual_override").notNull().default(false),
  failedCounter: integer("failed_counter").notNull().default(0),
  tester: text("tester").notNull(),
  dev: text("dev"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const testCases = pgTable("test_cases", {
  id: uuid("id").primaryKey().defaultRandom(),
  ticketId: uuid("ticket_id")
    .notNull()
    .references(() => tickets.id, { onDelete: "cascade" }),
  tcNumber: text("tc_number").notNull(),
  page: text("page").notNull(),
  description: text("description").notNull(),
  priority: testCasePriorityEnum("priority").notNull(),
  expectedResult: text("expected_result").notNull(),
  actualResult: text("actual_result"),
  comments: text("comments"),
  status: testCaseStatusEnum("status").notNull().default("NOT_TESTED"),
  testedDate: date("tested_date"),
  tester: text("tester").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// One row per retest round: snapshots a test case's result right before a
// Retest wipes it, so prior attempts stay visible after the row is reset.
export const testCaseHistory = pgTable("test_case_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  testCaseId: uuid("test_case_id")
    .notNull()
    .references(() => testCases.id, { onDelete: "cascade" }),
  ticketId: uuid("ticket_id")
    .notNull()
    .references(() => tickets.id, { onDelete: "cascade" }),
  round: integer("round").notNull(),
  status: testCaseStatusEnum("status").notNull(),
  actualResult: text("actual_result"),
  comments: text("comments"),
  testedDate: date("tested_date"),
  tester: text("tester").notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ticketsRelations = relations(tickets, ({ many }) => ({
  testCases: many(testCases),
}));

export const testCasesRelations = relations(testCases, ({ one, many }) => ({
  ticket: one(tickets, {
    fields: [testCases.ticketId],
    references: [tickets.id],
  }),
  history: many(testCaseHistory),
}));

export const testCaseHistoryRelations = relations(testCaseHistory, ({ one }) => ({
  testCase: one(testCases, {
    fields: [testCaseHistory.testCaseId],
    references: [testCases.id],
  }),
}));

export type Ticket = typeof tickets.$inferSelect;
export type NewTicket = typeof tickets.$inferInsert;
export type TestCase = typeof testCases.$inferSelect;
export type NewTestCase = typeof testCases.$inferInsert;
export type TestCaseHistory = typeof testCaseHistory.$inferSelect;
