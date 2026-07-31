import { describe, expect, it } from "vitest";
import { cleanupParsedRows, cleanupWorkbook, buildCleanedWorkbook } from "@/lib/import/cleanup";
import { parseWorkbook, type ColumnKey, type SheetRow } from "@/lib/import/parse-excel";

/** Mirrors the row/letter helpers in parse-excel.test.ts for consistency. */
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
  return String.fromCharCode("A".charCodeAt(0) + COLUMN_ORDER.indexOf(key));
}

function row(rowNumber: number, values: Partial<Record<ColumnKey, unknown>>): SheetRow {
  const cells: SheetRow["cells"] = {};
  for (const key of COLUMN_ORDER) {
    cells[key] = { value: values[key] ?? null, address: `${letter(key)}${rowNumber}` };
  }
  return { rowNumber, cells };
}

const fullRow = {
  testId: 1,
  title: "IMPLEMENT QUICKBOOKS INVOICE",
  tcNumber: "TC001",
  company: "POTB",
  system: "LakbayHub/POTB",
  module: "Invoicing",
  page: "Invoice - Create",
  description: "Verify an invoice syncs to QuickBooks on creation.",
  priority: "HIGH",
  issueType: "Bug Fix",
  expectedResult: "Invoice appears in QuickBooks within a minute.",
  actualResult: "Appeared immediately.",
  comments: "Verified against sandbox.",
  status: "Pass",
  ticketStatus: "Passed",
  failedCounter: 0,
  date: "2026-07-09",
  tester: "Byron",
  dev: "Arsh",
};

function get(result: ReturnType<typeof cleanupParsedRows>, rowNumber: number, key: ColumnKey) {
  return result.rows.find((r) => r.rowNumber === rowNumber)?.values[key];
}

describe("cleanupParsedRows: deterministic fixes", () => {
  it("corrects alias spelling and case (Bug Fix -> BUG, Pass -> PASSED, LakbayHub/POTB -> POTB)", () => {
    const result = cleanupParsedRows([row(2, fullRow)]);

    expect(get(result, 2, "issueType")).toBe("BUG");
    expect(get(result, 2, "status")).toBe("PASSED");
    expect(get(result, 2, "company")).toBe("POTB");
    expect(result.remainingIssues).toEqual([]);
    expect(result.fixes.length).toBeGreaterThan(0);
    expect(result.fixes.some((f) => f.column === "Issue Type" && f.to === "BUG")).toBe(true);
  });

  it("repairs the missing-separator date typo instead of just flagging it", () => {
    const result = cleanupParsedRows([row(2, { ...fullRow, date: "7/252026" })]);

    expect(get(result, 2, "date")).toBe("2026-07-25");
    expect(result.remainingIssues).toEqual([]);
    expect(
      result.fixes.some((f) => f.column === "Date" && f.from === "7/252026" && f.to === "2026-07-25")
    ).toBe(true);
  });

  it("fills a blank ticket-level cell down from the ticket's resolved value", () => {
    const result = cleanupParsedRows([
      row(2, fullRow),
      row(3, { ...fullRow, title: null, tcNumber: "TC002", company: null, module: null }),
    ]);

    expect(get(result, 3, "company")).toBe("POTB");
    expect(get(result, 3, "module")).toBe("Invoicing");
    expect(get(result, 3, "title")).toBe("IMPLEMENT QUICKBOOKS INVOICE");
    expect(
      result.fixes.some((f) => f.rowNumber === 3 && f.column === "Company" && f.to === "POTB")
    ).toBe(true);
  });

  it("fixes Title casing to match the group's canonical form without flagging it as a conflict", () => {
    const result = cleanupParsedRows([
      row(2, fullRow),
      row(3, { ...fullRow, title: "implement quickbooks invoice", tcNumber: "TC002" }),
    ]);

    expect(result.remainingIssues).toEqual([]);
    expect(get(result, 3, "title")).toBe("IMPLEMENT QUICKBOOKS INVOICE");
  });

  it("renumbers a duplicate Test Case ID within a ticket", () => {
    const result = cleanupParsedRows([
      row(2, fullRow),
      row(3, { ...fullRow, title: null, tcNumber: "TC001" }),
    ]);

    expect(get(result, 2, "tcNumber")).toBe("TC001");
    expect(get(result, 3, "tcNumber")).toBe("TC001-2");
    expect(
      result.fixes.some((f) => f.rowNumber === 3 && f.column === "Test Case ID" && f.to === "TC001-2")
    ).toBe(true);
    expect(result.remainingIssues).toEqual([]);
  });

  it("does not fix or flag Failed Counter disagreement — the sheet tracks it per row", () => {
    const result = cleanupParsedRows([
      row(2, { ...fullRow, failedCounter: 0 }),
      row(3, { ...fullRow, title: null, tcNumber: "TC002", failedCounter: 2 }),
    ]);

    expect(get(result, 2, "failedCounter")).toBe("0");
    expect(get(result, 3, "failedCounter")).toBe("2");
    expect(result.remainingIssues).toEqual([]);
  });
});

describe("cleanupParsedRows: things it refuses to invent", () => {
  it("leaves a conflicting Issue Type as two separate values and reports it once", () => {
    const result = cleanupParsedRows([
      row(2, fullRow),
      row(3, { ...fullRow, title: null, tcNumber: "TC002", issueType: "Feature" }),
    ]);

    expect(get(result, 2, "issueType")).toBe("BUG");
    expect(get(result, 3, "issueType")).toBe("FEATURE");
    expect(result.remainingIssues).toHaveLength(1);
    expect(result.remainingIssues[0].column).toBe("Issue Type");
    expect(result.remainingIssues[0].message).toMatch(/must agree/i);
  });

  it("leaves a blank required field blank and reports it as missing", () => {
    const result = cleanupParsedRows([row(2, { ...fullRow, expectedResult: null })]);

    expect(get(result, 2, "expectedResult")).toBeNull();
    expect(result.remainingIssues).toHaveLength(1);
    expect(result.remainingIssues[0].column).toBe("Expected Result");
    expect(result.remainingIssues[0].message).toMatch(/required/i);
  });

  it("leaves an unrecognized value untouched even when the rest of the ticket agrees", () => {
    const result = cleanupParsedRows([
      row(2, fullRow),
      row(3, { ...fullRow, title: null, tcNumber: "TC002", priority: "N/A" }),
    ]);

    expect(get(result, 2, "priority")).toBe("HIGH");
    expect(get(result, 3, "priority")).toBe("N/A");
    expect(result.remainingIssues).toHaveLength(1);
    expect(result.remainingIssues[0].column).toBe("Priority");
    expect(result.remainingIssues[0].message).toContain("N/A");
    // Doesn't get silently overwritten to HIGH just because row 2 says HIGH.
    expect(result.fixes.some((f) => f.rowNumber === 3 && f.column === "Priority")).toBe(false);
  });

  it("leaves an orphan continuation row untouched and reports it", () => {
    const result = cleanupParsedRows([
      row(2, { ...fullRow, title: null }),
      row(3, fullRow),
    ]);

    expect(result.remainingIssues.some((i) => i.message.match(/no Title/i))).toBe(true);
    // Passed through as-is — not silently dropped, not guessed at.
    expect(get(result, 2, "tcNumber")).toBe("TC001");
  });

  it("leaves a duplicate title block untouched and reports it", () => {
    const result = cleanupParsedRows([
      row(2, fullRow),
      row(3, { ...fullRow, title: "OTHER", tcNumber: "TC009" }),
      row(4, { ...fullRow, tcNumber: "TC010" }),
    ]);

    expect(result.remainingIssues.some((i) => i.message.match(/also appears at row 2/))).toBe(true);
    expect(get(result, 4, "tcNumber")).toBe("TC010");
  });
});

describe("cleanupWorkbook + buildCleanedWorkbook round trip", () => {
  it("produces a file that imports cleanly after fixing mechanical issues", async () => {
    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Sheet1");
    sheet.addRow(COLUMN_ORDER.map((key) => COLUMN_LABEL(key)));
    sheet.addRow(COLUMN_ORDER.map((key) => fullRow[key]));
    sheet.addRow(
      COLUMN_ORDER.map((key) => {
        if (key === "title") return null;
        if (key === "tcNumber") return "TC002";
        if (key === "date") return "7/252026";
        return (fullRow as Record<string, unknown>)[key];
      })
    );
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    const cleaned = await cleanupWorkbook(buffer);
    expect(cleaned.fileErrors).toEqual([]);
    expect(cleaned.remainingIssues).toEqual([]);
    expect(cleaned.rows).toHaveLength(2);

    const outputBuffer = await buildCleanedWorkbook(cleaned.rows);
    const reparsed = await parseWorkbook(outputBuffer);

    expect(reparsed.fileErrors).toEqual([]);
    expect(reparsed.rejected).toEqual([]);
    expect(reparsed.tickets).toHaveLength(1);
    expect(reparsed.tickets[0].testCases.map((tc) => tc.tcNumber)).toEqual(["TC001", "TC002"]);
    expect(reparsed.tickets[0].testCases[1].testedDate).toBe("2026-07-25");
  });

  it("reports stray non-test-case rows through removedRowNumbers, same as the normal parser", async () => {
    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Sheet1");
    sheet.addRow(COLUMN_ORDER.map((key) => COLUMN_LABEL(key)));
    sheet.addRow(COLUMN_ORDER.map((key) => fullRow[key]));
    sheet.addRow(COLUMN_ORDER.map((key) => (key === "failedCounter" ? 1 : null)));
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    const cleaned = await cleanupWorkbook(buffer);

    expect(cleaned.removedRowNumbers).toEqual([3]);
    expect(cleaned.rows).toHaveLength(1);
  });
});

function COLUMN_LABEL(key: ColumnKey): string {
  const labels: Record<ColumnKey, string> = {
    testId: "Test ID",
    title: "Title",
    tcNumber: "Test Case ID",
    company: "Company",
    system: "System",
    module: "Module",
    page: "Page",
    description: "Description",
    priority: "Priority",
    issueType: "Issue Type",
    expectedResult: "Expected Result",
    actualResult: "Actual Result",
    comments: "Comments",
    status: "Status",
    ticketStatus: "Ticket Status",
    failedCounter: "Failed Counter",
    date: "Date",
    tester: "Lakbay Tester's",
    dev: "DEVS",
  };
  return labels[key];
}
