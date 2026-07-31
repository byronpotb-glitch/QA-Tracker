import { describe, expect, it } from "vitest";
import {
  reconcile,
  type ExistingTestCase,
  type ExistingTicket,
} from "@/lib/import/reconcile";
import type { ParsedTestCase, ParsedTicket } from "@/lib/import/parse-excel";

function parsedTestCase(over: Partial<ParsedTestCase> = {}): ParsedTestCase {
  return {
    tcNumber: "TC001",
    page: "Booking",
    description: "Verify dropdown loads.",
    priority: "HIGH",
    expectedResult: "Dropdown populates.",
    actualResult: "Populated.",
    comments: null,
    status: "PASSED",
    testedDate: "2026-07-09",
    rowNumber: 2,
    ...over,
  };
}

function parsedTicket(over: Partial<ParsedTicket> = {}): ParsedTicket {
  return {
    title: "FIX PARTNER DROPDOWN",
    company: "POTB",
    system: "LakbayHub/POTB",
    module: "Partner Management",
    issueType: "BUG",
    ticketStatus: "PASSED",
    failedCounter: 0,
    tester: "Byron",
    dev: "Arsh",
    testCases: [parsedTestCase()],
    firstRow: 2,
    lastRow: 2,
    ...over,
  };
}

function existingTestCase(over: Partial<ExistingTestCase> = {}): ExistingTestCase {
  return {
    id: "tc-1",
    tcNumber: "TC001",
    page: "Booking",
    description: "Verify dropdown loads.",
    priority: "HIGH",
    expectedResult: "Dropdown populates.",
    actualResult: "Populated.",
    comments: null,
    status: "PASSED",
    testedDate: "2026-07-09",
    maxHistoryRound: 0,
    tester: "Byron",
    ...over,
  };
}

function existingTicket(over: Partial<ExistingTicket> = {}): ExistingTicket {
  return {
    id: "ticket-1",
    title: "FIX PARTNER DROPDOWN",
    company: "POTB",
    system: "LakbayHub/POTB",
    module: "Partner Management",
    issueType: "BUG",
    ticketStatus: "PASSED",
    failedCounter: 0,
    manualOverride: true,
    tester: "Byron",
    dev: "Arsh",
    testCases: [existingTestCase()],
    ...over,
  };
}

describe("reconcile classification", () => {
  it("marks an unmatched ticket as new", () => {
    const result = reconcile([parsedTicket()], []);

    expect(result.plans).toHaveLength(1);
    expect(result.plans[0].kind).toBe("new");
    expect(result.summary).toMatchObject({ newTickets: 1, newTestCases: 1 });
  });

  it("matches on title and company, case-insensitively", () => {
    const result = reconcile(
      [parsedTicket({ title: "fix partner dropdown" })],
      [existingTicket()]
    );

    expect(result.plans[0].kind).not.toBe("new");
  });

  it("treats the same title under a different company as a different ticket", () => {
    const result = reconcile(
      [parsedTicket({ company: "GLADEX" })],
      [existingTicket()]
    );

    expect(result.plans[0].kind).toBe("new");
  });

  it("skips a ticket whose every field already matches", () => {
    const result = reconcile([parsedTicket()], [existingTicket()]);

    expect(result.plans[0]).toMatchObject({
      kind: "unchanged",
      ticketId: "ticket-1",
    });
    expect(result.summary).toMatchObject({
      unchangedTickets: 1,
      updatedTickets: 0,
      updatedTestCases: 0,
    });
  });
});

describe("reconcile test case changes", () => {
  it("writes result-field changes", () => {
    const result = reconcile(
      [
        parsedTicket({
          testCases: [
            parsedTestCase({ status: "FAILED", actualResult: "Empty on init." }),
          ],
        }),
      ],
      [existingTicket()]
    );

    const plan = result.plans[0];
    expect(plan.kind).toBe("update");
    if (plan.kind !== "update") return;

    const tc = plan.testCases[0];
    expect(tc.kind).toBe("update");
    if (tc.kind !== "update") return;

    expect(tc.changes.map((c) => c.field).sort()).toEqual([
      "actualResult",
      "status",
    ]);
    expect(tc.values.status).toBe("FAILED");
    expect(result.summary.updatedTestCases).toBe(1);
  });

  it("warns about definition-field differences without writing them", () => {
    const result = reconcile(
      [
        parsedTicket({
          testCases: [parsedTestCase({ description: "Verify something else." })],
        }),
      ],
      [existingTicket()]
    );

    const plan = result.plans[0];
    expect(plan.kind).toBe("update");
    if (plan.kind !== "update") return;

    // Nothing to write — a description drift is reported, not applied.
    expect(plan.testCases).toHaveLength(0);
    expect(plan.changes).toHaveLength(0);
    expect(plan.warnings).toHaveLength(1);
    expect(plan.warnings[0].label).toBe("TC001 · Description");
    expect(result.summary).toMatchObject({ warnings: 1, updatedTickets: 0 });
  });

  it("inserts a test case the tracker doesn't have yet", () => {
    const result = reconcile(
      [
        parsedTicket({
          testCases: [parsedTestCase(), parsedTestCase({ tcNumber: "TC002" })],
        }),
      ],
      [existingTicket()]
    );

    const plan = result.plans[0];
    if (plan.kind !== "update") throw new Error("expected an update plan");

    expect(plan.testCases).toHaveLength(1);
    expect(plan.testCases[0]).toMatchObject({ kind: "insert", tcNumber: "TC002" });
    expect(result.summary.newTestCases).toBe(1);
  });

  it("counts but never deletes test cases missing from the sheet", () => {
    const result = reconcile(
      [parsedTicket({ testCases: [parsedTestCase()] })],
      [
        existingTicket({
          testCases: [
            existingTestCase(),
            existingTestCase({ id: "tc-2", tcNumber: "TC002" }),
          ],
        }),
      ]
    );

    const plan = result.plans[0];
    if (plan.kind !== "update") throw new Error("expected an update plan");

    expect(plan.missingTcNumbers).toEqual(["TC002"]);
    expect(plan.testCases).toHaveLength(0);
    expect(result.summary.missingTestCases).toBe(1);
  });
});

describe("reconcile history snapshots", () => {
  it("snapshots the pre-import row when Status changes", () => {
    const result = reconcile(
      [parsedTicket({ testCases: [parsedTestCase({ status: "FAILED" })] })],
      [
        existingTicket({
          testCases: [
            existingTestCase({
              status: "PASSED",
              actualResult: "Worked before.",
              maxHistoryRound: 2,
            }),
          ],
        }),
      ]
    );

    const plan = result.plans[0];
    if (plan.kind !== "update") throw new Error("expected an update plan");
    const tc = plan.testCases[0];
    if (tc.kind !== "update") throw new Error("expected a test case update");

    expect(tc.history).toMatchObject({
      round: 3,
      status: "PASSED",
      actualResult: "Worked before.",
      tester: "Byron",
    });
    expect(result.summary.historySnapshots).toBe(1);
  });

  it("does not snapshot when only comments change", () => {
    const result = reconcile(
      [parsedTicket({ testCases: [parsedTestCase({ comments: "Retested." })] })],
      [existingTicket()]
    );

    const plan = result.plans[0];
    if (plan.kind !== "update") throw new Error("expected an update plan");
    const tc = plan.testCases[0];
    if (tc.kind !== "update") throw new Error("expected a test case update");

    expect(tc.changes.map((c) => c.field)).toEqual(["comments"]);
    expect(tc.history).toBeNull();
    expect(result.summary.historySnapshots).toBe(0);
  });
});

describe("reconcile ticket-level fields", () => {
  it("updates ticket fields from the sheet and freezes an asserted status", () => {
    const result = reconcile(
      [parsedTicket({ module: "Partners", ticketStatus: "FAILED", failedCounter: 2 })],
      [existingTicket()]
    );

    const plan = result.plans[0];
    if (plan.kind !== "update") throw new Error("expected an update plan");

    expect(plan.changes.map((c) => c.field).sort()).toEqual([
      "failedCounter",
      "module",
      "ticketStatus",
    ]);
    expect(plan.manualOverride).toBe(true);
  });

  it("leaves status to the rollup when the sheet omits Ticket Status", () => {
    const result = reconcile(
      [
        parsedTicket({
          ticketStatus: null,
          module: "Partners",
          testCases: [parsedTestCase({ status: "FAILED" })],
        }),
      ],
      [existingTicket()]
    );

    const plan = result.plans[0];
    if (plan.kind !== "update") throw new Error("expected an update plan");

    // A blank Ticket Status column must not read as "reset this ticket".
    expect(plan.changes.map((c) => c.field)).toEqual(["module"]);
    expect(plan.manualOverride).toBe(false);
  });

  it("derives a new ticket's status from its test cases when the sheet omits it", () => {
    const result = reconcile(
      [
        parsedTicket({
          ticketStatus: null,
          testCases: [
            parsedTestCase({ status: "PASSED" }),
            parsedTestCase({ tcNumber: "TC002", status: "FAILED" }),
          ],
        }),
      ],
      []
    );

    const plan = result.plans[0];
    if (plan.kind !== "new") throw new Error("expected a new plan");

    expect(plan.resolvedStatus).toBe("FAILED");
    expect(plan.manualOverride).toBe(false);
  });

  it("uses the asserted status verbatim for a new ticket", () => {
    const result = reconcile(
      [parsedTicket({ ticketStatus: "ON_HOLD", testCases: [parsedTestCase()] })],
      []
    );

    const plan = result.plans[0];
    if (plan.kind !== "new") throw new Error("expected a new plan");

    expect(plan.resolvedStatus).toBe("ON_HOLD");
    expect(plan.manualOverride).toBe(true);
  });
});
