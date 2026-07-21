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
  "BUG_FIX",
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

export const ticketsRelations = relations(tickets, ({ many }) => ({
  testCases: many(testCases),
}));

export const testCasesRelations = relations(testCases, ({ one }) => ({
  ticket: one(tickets, {
    fields: [testCases.ticketId],
    references: [tickets.id],
  }),
}));

export type Ticket = typeof tickets.$inferSelect;
export type NewTicket = typeof tickets.$inferInsert;
export type TestCase = typeof testCases.$inferSelect;
export type NewTestCase = typeof testCases.$inferInsert;
