/**
 * Diffs parsed sheet tickets against what's already in the tracker.
 *
 * Pure: takes plain data in, returns plain data out. No database, no ExcelJS.
 * The server action feeds it existing rows and turns the result into writes.
 *
 * The point is that re-uploading an updated sheet is safe and quiet — only
 * what actually changed gets written, and nothing is ever deleted.
 */
import { computeRollupStatus } from "@/lib/rollup";
import type { TestCaseStatus, TicketStatus } from "@/lib/validations";
import type { ParsedTestCase, ParsedTicket } from "./parse-excel";

/**
 * Test case result fields the sheet owns. These are the live state of a test
 * run, so the sheet is authoritative and they get written.
 */
export const RESULT_FIELDS = [
  "status",
  "actualResult",
  "comments",
  "testedDate",
] as const;

/**
 * Test case definition fields — what the test *is*. A difference here is
 * reported as a warning and NOT written: the tracker may hold a deliberately
 * edited description that the sheet hasn't caught up with.
 */
export const DEFINITION_FIELDS = [
  "page",
  "description",
  "expectedResult",
  "priority",
] as const;

export type ResultField = (typeof RESULT_FIELDS)[number];
export type DefinitionField = (typeof DEFINITION_FIELDS)[number];

const FIELD_LABELS: Record<ResultField | DefinitionField | string, string> = {
  status: "Status",
  actualResult: "Actual Result",
  comments: "Comments",
  testedDate: "Date",
  page: "Page",
  description: "Description",
  expectedResult: "Expected Result",
  priority: "Priority",
  system: "System",
  module: "Module",
  issueType: "Issue Type",
  ticketStatus: "Ticket Status",
  failedCounter: "Failed Counter",
  tester: "Tester",
  dev: "Dev",
};

export function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

/** The subset of a stored test case reconciliation needs. */
export interface ExistingTestCase {
  id: string;
  tcNumber: string;
  page: string;
  description: string;
  priority: string;
  expectedResult: string;
  actualResult: string | null;
  comments: string | null;
  status: TestCaseStatus;
  testedDate: string | null;
  /** Highest history round already recorded, or 0 if none. */
  maxHistoryRound: number;
  tester: string;
}

/** The subset of a stored ticket reconciliation needs. */
export interface ExistingTicket {
  id: string;
  title: string;
  company: string;
  system: string;
  module: string;
  issueType: string;
  ticketStatus: TicketStatus;
  failedCounter: number;
  manualOverride: boolean;
  tester: string;
  dev: string | null;
  testCases: ExistingTestCase[];
}

export interface FieldChange {
  field: string;
  label: string;
  from: string;
  to: string;
}

export interface TestCaseInsertPlan {
  kind: "insert";
  tcNumber: string;
  rowNumber: number;
  data: ParsedTestCase;
}

export interface TestCaseUpdatePlan {
  kind: "update";
  testCaseId: string;
  tcNumber: string;
  rowNumber: number;
  /** Only result fields — definition differences are warnings, not writes. */
  changes: FieldChange[];
  values: Pick<ParsedTestCase, ResultField>;
  /** A status change snapshots the pre-import row into history first. */
  history: {
    round: number;
    status: TestCaseStatus;
    actualResult: string | null;
    comments: string | null;
    testedDate: string | null;
    tester: string;
  } | null;
  /** Definition-field differences: shown, not written. */
  warnings: FieldChange[];
}

export type TestCasePlan = TestCaseInsertPlan | TestCaseUpdatePlan;

export interface NewTicketPlan {
  kind: "new";
  ticket: ParsedTicket;
  /** Status to store, and whether the sheet froze it. */
  resolvedStatus: TicketStatus;
  manualOverride: boolean;
}

export interface UpdateTicketPlan {
  kind: "update";
  ticketId: string;
  ticket: ParsedTicket;
  /** Ticket-level field changes that will be written. */
  changes: FieldChange[];
  testCases: TestCasePlan[];
  /** Definition-field differences across this ticket's test cases. */
  warnings: FieldChange[];
  /**
   * Test cases in the tracker with no row in the sheet. Never deleted — the
   * sheet may be a partial export — just counted so the omission is visible.
   */
  missingTcNumbers: string[];
  manualOverride: boolean;
}

export interface UnchangedTicketPlan {
  kind: "unchanged";
  ticketId: string;
  title: string;
  testCaseCount: number;
}

export type TicketPlan = NewTicketPlan | UpdateTicketPlan | UnchangedTicketPlan;

export interface ReconcileResult {
  plans: TicketPlan[];
  summary: {
    newTickets: number;
    updatedTickets: number;
    unchangedTickets: number;
    newTestCases: number;
    updatedTestCases: number;
    historySnapshots: number;
    warnings: number;
    missingTestCases: number;
  };
}

/** Tickets are identified by what identifies them in the sheet. */
function ticketKey(title: string, company: string): string {
  return `${title.trim().toUpperCase()}::${company.trim().toUpperCase()}`;
}

function tcKey(tcNumber: string): string {
  return tcNumber.trim().toUpperCase();
}

/** Renders a value for the preview's "from → to" text. */
function display(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function diff(
  field: string,
  from: unknown,
  to: unknown
): FieldChange | null {
  const a = from ?? null;
  const b = to ?? null;
  if (a === b) return null;
  return { field, label: fieldLabel(field), from: display(a), to: display(b) };
}

/**
 * When the sheet leaves Ticket Status blank, fall back to the rollup over the
 * sheet's test case statuses so the ticket still gets a sensible status — and
 * leave manualOverride off so the tracker keeps managing it.
 */
function resolveTicketStatus(
  ticket: ParsedTicket,
  fallback: TicketStatus
): { status: TicketStatus; manualOverride: boolean } {
  if (ticket.ticketStatus !== null) {
    return { status: ticket.ticketStatus, manualOverride: true };
  }

  const computed = computeRollupStatus(
    ticket.testCases.map((tc) => tc.status as TestCaseStatus)
  );

  return { status: computed ?? fallback, manualOverride: false };
}

export function reconcile(
  parsed: ParsedTicket[],
  existing: ExistingTicket[]
): ReconcileResult {
  const existingByKey = new Map(
    existing.map((ticket) => [ticketKey(ticket.title, ticket.company), ticket])
  );

  const plans: TicketPlan[] = [];

  for (const ticket of parsed) {
    const match = existingByKey.get(ticketKey(ticket.title, ticket.company));

    if (!match) {
      const resolved = resolveTicketStatus(ticket, "PENDING");
      plans.push({
        kind: "new",
        ticket,
        resolvedStatus: resolved.status,
        manualOverride: resolved.manualOverride,
      });
      continue;
    }

    plans.push(planUpdate(ticket, match));
  }

  return { plans, summary: summarize(plans) };
}

function planUpdate(
  ticket: ParsedTicket,
  existing: ExistingTicket
): UpdateTicketPlan | UnchangedTicketPlan {
  const resolved = resolveTicketStatus(ticket, existing.ticketStatus);

  const ticketChanges = [
    diff("system", existing.system, ticket.system),
    diff("module", existing.module, ticket.module),
    diff("issueType", existing.issueType, ticket.issueType),
    diff("tester", existing.tester, ticket.tester),
    diff("dev", existing.dev, ticket.dev),
    // Only claim a status/counter change when the sheet actually asserts one.
    // A blank Ticket Status column must not look like "reset to PENDING".
    ticket.ticketStatus !== null
      ? diff("ticketStatus", existing.ticketStatus, ticket.ticketStatus)
      : null,
    ticket.ticketStatus !== null
      ? diff("failedCounter", existing.failedCounter, ticket.failedCounter)
      : null,
  ].filter((change): change is FieldChange => change !== null);

  const existingByTc = new Map(
    existing.testCases.map((tc) => [tcKey(tc.tcNumber), tc])
  );

  const testCasePlans: TestCasePlan[] = [];
  const warnings: FieldChange[] = [];
  const seen = new Set<string>();

  for (const parsedTc of ticket.testCases) {
    const key = tcKey(parsedTc.tcNumber);
    seen.add(key);
    const existingTc = existingByTc.get(key);

    if (!existingTc) {
      testCasePlans.push({
        kind: "insert",
        tcNumber: parsedTc.tcNumber,
        rowNumber: parsedTc.rowNumber,
        data: parsedTc,
      });
      continue;
    }

    const resultChanges = RESULT_FIELDS.map((field) =>
      diff(field, existingTc[field], parsedTc[field])
    ).filter((change): change is FieldChange => change !== null);

    const definitionChanges = DEFINITION_FIELDS.map((field) =>
      diff(field, existingTc[field], parsedTc[field])
    ).filter((change): change is FieldChange => change !== null);

    // Warnings are reported whether or not anything is written, so a
    // definition drift on an otherwise-unchanged test case is still visible.
    for (const change of definitionChanges) {
      warnings.push({
        ...change,
        label: `${parsedTc.tcNumber} · ${change.label}`,
      });
    }

    if (resultChanges.length === 0) continue;

    const statusChanged = resultChanges.some(
      (change) => change.field === "status"
    );

    testCasePlans.push({
      kind: "update",
      testCaseId: existingTc.id,
      tcNumber: parsedTc.tcNumber,
      rowNumber: parsedTc.rowNumber,
      changes: resultChanges,
      values: {
        status: parsedTc.status,
        actualResult: parsedTc.actualResult,
        comments: parsedTc.comments,
        testedDate: parsedTc.testedDate,
      },
      history: statusChanged
        ? {
            round: existingTc.maxHistoryRound + 1,
            status: existingTc.status,
            actualResult: existingTc.actualResult,
            comments: existingTc.comments,
            testedDate: existingTc.testedDate,
            tester: existingTc.tester,
          }
        : null,
      warnings: definitionChanges,
    });
  }

  const missingTcNumbers = existing.testCases
    .filter((tc) => !seen.has(tcKey(tc.tcNumber)))
    .map((tc) => tc.tcNumber);

  const hasWrites = ticketChanges.length > 0 || testCasePlans.length > 0;

  if (!hasWrites && warnings.length === 0 && missingTcNumbers.length === 0) {
    return {
      kind: "unchanged",
      ticketId: existing.id,
      title: existing.title,
      testCaseCount: existing.testCases.length,
    };
  }

  if (!hasWrites) {
    // Nothing to write, but there's something worth telling the user about.
    // Report it as unchanged so the apply step stays a no-op for this ticket,
    // and surface the detail through the warning counts below.
    return {
      kind: "update",
      ticketId: existing.id,
      ticket,
      changes: [],
      testCases: [],
      warnings,
      missingTcNumbers,
      manualOverride: resolved.manualOverride,
    };
  }

  return {
    kind: "update",
    ticketId: existing.id,
    ticket,
    changes: ticketChanges,
    testCases: testCasePlans,
    warnings,
    missingTcNumbers,
    manualOverride: resolved.manualOverride,
  };
}

function summarize(plans: TicketPlan[]): ReconcileResult["summary"] {
  const summary: ReconcileResult["summary"] = {
    newTickets: 0,
    updatedTickets: 0,
    unchangedTickets: 0,
    newTestCases: 0,
    updatedTestCases: 0,
    historySnapshots: 0,
    warnings: 0,
    missingTestCases: 0,
  };

  for (const plan of plans) {
    if (plan.kind === "new") {
      summary.newTickets++;
      summary.newTestCases += plan.ticket.testCases.length;
      continue;
    }

    if (plan.kind === "unchanged") {
      summary.unchangedTickets++;
      continue;
    }

    // An "update" plan with no writes is a warning-only report, not an update.
    if (plan.changes.length === 0 && plan.testCases.length === 0) {
      summary.unchangedTickets++;
    } else {
      summary.updatedTickets++;
    }

    summary.warnings += plan.warnings.length;
    summary.missingTestCases += plan.missingTcNumbers.length;

    for (const tc of plan.testCases) {
      if (tc.kind === "insert") summary.newTestCases++;
      else {
        summary.updatedTestCases++;
        if (tc.history) summary.historySnapshots++;
      }
    }
  }

  return summary;
}
