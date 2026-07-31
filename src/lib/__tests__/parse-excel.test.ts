import { describe, expect, it } from "vitest";
import {
  parseRows,
  type ColumnKey,
  type SheetRow,
} from "@/lib/import/parse-excel";

/**
 * Column order used to synthesize cell addresses, matching the real sheet.
 * These tests exercise parseRows, which is the pure half — reading the
 * workbook itself is ExcelJS's job.
 */
const COLUMN_ORDER: ColumnKey[] = [
  "testId",
  "title",
  "tcNumber",
  "company",
  "system",
  "module",
  "page",
  "description",
  "priority",
  "issueType",
  "expectedResult",
  "actualResult",
  "comments",
  "status",
  "ticketStatus",
  "failedCounter",
  "date",
  "tester",
  "dev",
];

function letter(key: ColumnKey): string {
  const index = COLUMN_ORDER.indexOf(key);
  return String.fromCharCode("A".charCodeAt(0) + index);
}

function row(
  rowNumber: number,
  values: Partial<Record<ColumnKey, unknown>>
): SheetRow {
  const cells: SheetRow["cells"] = {};
  for (const key of COLUMN_ORDER) {
    cells[key] = {
      value: values[key] ?? null,
      address: `${letter(key)}${rowNumber}`,
    };
  }
  return { rowNumber, cells };
}

/** A complete, valid first row of a ticket. */
const fullRow = {
  testId: 1,
  title: "FIX PARTNER DROPDOWN",
  tcNumber: "TC001",
  company: "POTB",
  system: "LakbayHub/POTB",
  module: "Partner Management",
  page: "Booking - Partner Dropdown",
  description: "Verify partner dropdown loads on page init.",
  priority: "HIGH",
  issueType: "Bug Fix",
  expectedResult: "Dropdown populates immediately.",
  actualResult: "Dropdown populated correctly.",
  comments: "Core fix confirmed.",
  status: "Passed",
  ticketStatus: "Passed",
  failedCounter: 0,
  date: "2026-07-09",
  tester: "Byron",
  dev: "Arsh",
};

/** A continuation row: ticket-level cells blank, test case cells filled. */
const continuationRow = {
  tcNumber: "TC002",
  page: "Booking - Partner Dropdown",
  description: "Verify dropdown reopens after navigation.",
  priority: "MEDIUM",
  expectedResult: "Dropdown still populated.",
  status: "Failed",
  actualResult: "Dropdown empty on return.",
  date: "2026-07-10",
};

describe("parseRows grouping", () => {
  it("treats a blank Title as a continuation of the ticket above", () => {
    const result = parseRows([
      row(2, fullRow),
      row(3, continuationRow),
      row(4, { ...continuationRow, tcNumber: "TC003", status: "Passed" }),
    ]);

    expect(result.fileErrors).toEqual([]);
    expect(result.rejected).toEqual([]);
    expect(result.tickets).toHaveLength(1);
    expect(result.tickets[0].testCases.map((tc) => tc.tcNumber)).toEqual([
      "TC001",
      "TC002",
      "TC003",
    ]);
  });

  it("treats a repeated Title as one ticket, which is what a merged cell reads as", () => {
    // ExcelJS returns the master's value for every cell in a merge range, so a
    // Title merged down three rows arrives as the same string three times.
    const result = parseRows([
      row(2, fullRow),
      row(3, { ...continuationRow, title: fullRow.title, company: "POTB" }),
      row(4, {
        ...continuationRow,
        tcNumber: "TC003",
        title: fullRow.title,
        company: "POTB",
        status: "Passed",
      }),
    ]);

    expect(result.rejected).toEqual([]);
    expect(result.tickets).toHaveLength(1);
    expect(result.tickets[0].testCases).toHaveLength(3);
  });

  it("starts a new ticket when the Title changes", () => {
    const result = parseRows([
      row(2, fullRow),
      row(3, continuationRow),
      row(4, { ...fullRow, title: "SECOND TICKET", company: "GLADEX" }),
    ]);

    expect(result.rejected).toEqual([]);
    expect(result.tickets.map((t) => t.title)).toEqual([
      "FIX PARTNER DROPDOWN",
      "SECOND TICKET",
    ]);
    expect(result.tickets[1].company).toBe("GLADEX");
  });

  it("rejects a continuation row with no ticket above it", () => {
    const result = parseRows([row(2, continuationRow), row(3, fullRow)]);

    expect(result.tickets).toHaveLength(1);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].issues[0].message).toMatch(/no Title/i);
    expect(result.rejected[0].issues[0].cell).toBe(`${letter("title")}2`);
  });

  it("rejects a title that reappears in a separate block", () => {
    const result = parseRows([
      row(2, fullRow),
      row(3, { ...fullRow, title: "OTHER", tcNumber: "TC009" }),
      row(4, { ...fullRow, tcNumber: "TC010" }),
    ]);

    expect(result.tickets.map((t) => t.title)).toEqual([
      "FIX PARTNER DROPDOWN",
      "OTHER",
    ]);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].issues[0].message).toMatch(/also appears at row 2/);
  });

  it("reports a file error for no data rows", () => {
    expect(parseRows([]).fileErrors).toHaveLength(1);
  });
});

describe("parseRows ticket-level fields", () => {
  it("accepts rows that disagree in spelling but agree after normalizing", () => {
    const result = parseRows([
      row(2, fullRow),
      row(3, { ...continuationRow, company: "LakbayHub/POTB", issueType: "BUG" }),
    ]);

    expect(result.rejected).toEqual([]);
    expect(result.tickets[0].company).toBe("POTB");
    expect(result.tickets[0].issueType).toBe("BUG");
  });

  it("rejects a ticket whose rows disagree on Issue Type", () => {
    const result = parseRows([
      row(2, fullRow),
      row(3, { ...continuationRow, issueType: "FEATURE" }),
    ]);

    expect(result.tickets).toEqual([]);
    expect(result.rejected).toHaveLength(1);
    const issue = result.rejected[0].issues[0];
    expect(issue.column).toBe("Issue Type");
    expect(issue.cell).toBe(`${letter("issueType")}3`);
    expect(issue.message).toMatch(/must agree/i);
    // Names the cell it disagrees with, not just the offending one.
    expect(issue.message).toContain(`${letter("issueType")}2`);
  });

  it("takes the highest Failed Counter when rows disagree", () => {
    // The real sheet fills Failed Counter in per test case, so rows genuinely
    // differ; the ticket stores one number and the highest is the meaningful one.
    const result = parseRows([
      row(2, { ...fullRow, failedCounter: 0 }),
      row(3, { ...continuationRow, failedCounter: 2 }),
      row(4, { ...continuationRow, tcNumber: "TC003", failedCounter: 1 }),
    ]);

    expect(result.rejected).toEqual([]);
    expect(result.tickets[0].failedCounter).toBe(2);
  });

  it("still rejects a Failed Counter that isn't a whole number", () => {
    const result = parseRows([row(2, { ...fullRow, failedCounter: "twice" })]);

    expect(result.tickets).toEqual([]);
    expect(result.rejected[0].issues[0].column).toBe("Failed Counter");
  });

  it("leaves ticketStatus null when the sheet never fills it in", () => {
    const result = parseRows([
      row(2, { ...fullRow, ticketStatus: null }),
      row(3, continuationRow),
    ]);

    expect(result.rejected).toEqual([]);
    expect(result.tickets[0].ticketStatus).toBeNull();
    expect(result.tickets[0].failedCounter).toBe(0);
  });

  it("reads dev as null when the column holds a placeholder", () => {
    const result = parseRows([row(2, { ...fullRow, dev: "-" })]);

    expect(result.rejected).toEqual([]);
    expect(result.tickets[0].dev).toBeNull();
  });

  it("rejects a ticket missing a required ticket-level field", () => {
    const result = parseRows([row(2, { ...fullRow, module: null })]);

    expect(result.tickets).toEqual([]);
    expect(result.rejected[0].issues[0].column).toBe("Module");
    expect(result.rejected[0].issues[0].message).toMatch(/missing/i);
  });
});

describe("parseRows test case fields", () => {
  it("normalizes values and nulls the empty optional ones", () => {
    const result = parseRows([
      row(2, { ...fullRow, actualResult: "", comments: "-", date: "" }),
    ]);

    const tc = result.tickets[0].testCases[0];
    expect(tc).toMatchObject({
      tcNumber: "TC001",
      priority: "HIGH",
      status: "PASSED",
      actualResult: null,
      comments: null,
      testedDate: null,
      rowNumber: 2,
    });
  });

  it("rejects the whole ticket when one cell is unreadable, naming the cell", () => {
    const result = parseRows([
      row(2, fullRow),
      row(3, { ...continuationRow, priority: "N/A" }),
    ]);

    expect(result.tickets).toEqual([]);
    expect(result.rejected).toHaveLength(1);
    const issue = result.rejected[0].issues[0];
    expect(issue.cell).toBe(`${letter("priority")}3`);
    expect(issue.column).toBe("Priority");
    expect(issue.message).toContain("N/A");
  });

  it("keeps other tickets importable when one is rejected", () => {
    const result = parseRows([
      row(2, fullRow),
      row(3, { ...fullRow, title: "BAD TICKET", tcNumber: "TC001", status: "SKIPPED" }),
      row(4, { ...fullRow, title: "GOOD TICKET", tcNumber: "TC001" }),
    ]);

    expect(result.tickets.map((t) => t.title)).toEqual([
      "FIX PARTNER DROPDOWN",
      "GOOD TICKET",
    ]);
    expect(result.rejected.map((r) => r.title)).toEqual(["BAD TICKET"]);
  });

  it("rejects a duplicated Test Case ID within one ticket", () => {
    const result = parseRows([
      row(2, fullRow),
      row(3, { ...continuationRow, tcNumber: "TC001" }),
    ]);

    expect(result.tickets).toEqual([]);
    const issue = result.rejected[0].issues[0];
    expect(issue.column).toBe("Test Case ID");
    expect(issue.message).toMatch(/already used by row 2/);
  });

  it("reads a real Excel date cell", () => {
    const result = parseRows([
      row(2, { ...fullRow, date: new Date(Date.UTC(2026, 6, 9)) }),
    ]);

    expect(result.tickets[0].testCases[0].testedDate).toBe("2026-07-09");
  });
});
