/**
 * Round-trips real .xlsx buffers through readWorkbook.
 *
 * The pure parsing is covered in parse-excel.test.ts; this covers the ExcelJS
 * half that those tests stub out — header detection, merged cells, column
 * reordering, and the file-level rejections.
 */
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { parseWorkbook, readWorkbook } from "@/lib/import/parse-excel";

const HEADERS = [
  "Test ID",
  "Title",
  "Test Case ID",
  "Company",
  "System",
  "Module",
  "Page",
  "Description",
  "Priority",
  "Issue Type",
  "Expected Result",
  "Actual Result",
  "Comments",
  "Status",
  "Ticket Status",
  "Failed Counter",
  "Date",
  "Lakbay Tester's",
  "DEVS",
];

/** A full row of values in HEADERS order. */
function fullRow(over: Record<string, unknown> = {}): unknown[] {
  const base: Record<string, unknown> = {
    "Test ID": 1,
    Title: "FIX PARTNER DROPDOWN",
    "Test Case ID": "TC001",
    Company: "POTB",
    System: "LakbayHub/POTB",
    Module: "Partner Management",
    Page: "Booking - Partner Dropdown",
    Description: "Verify partner dropdown loads on page init.",
    Priority: "HIGH",
    "Issue Type": "Bug Fix",
    "Expected Result": "Dropdown populates immediately.",
    "Actual Result": "Populated correctly.",
    Comments: "Core fix confirmed.",
    Status: "Passed",
    "Ticket Status": "Passed",
    "Failed Counter": 0,
    Date: "2026-07-09",
    "Lakbay Tester's": "Byron",
    DEVS: "Arsh",
    ...over,
  };
  return HEADERS.map((header) => base[header] ?? null);
}

async function toBuffer(
  build: (sheet: ExcelJS.Worksheet) => void,
  headers: string[] = HEADERS
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Sheet1");
  if (headers.length > 0) sheet.addRow(headers);
  build(sheet);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe("readWorkbook", () => {
  it("reads a straightforward sheet", async () => {
    const buffer = await toBuffer((sheet) => {
      sheet.addRow(fullRow());
      sheet.addRow(fullRow({ "Test Case ID": "TC002", Status: "Failed" }));
    });

    const result = await parseWorkbook(buffer);

    expect(result.fileErrors).toEqual([]);
    expect(result.rejected).toEqual([]);
    expect(result.tickets).toHaveLength(1);
    expect(result.tickets[0].testCases.map((tc) => tc.status)).toEqual([
      "PASSED",
      "FAILED",
    ]);
  });

  it("reads a merged Title as one ticket spanning its rows", async () => {
    const buffer = await toBuffer((sheet) => {
      sheet.addRow(fullRow());
      // Continuation rows leave the merged ticket-level columns out entirely.
      sheet.addRow(
        fullRow({
          Title: null,
          "Test Case ID": "TC002",
          Company: null,
          System: null,
          Module: null,
          "Issue Type": null,
          Status: "Failed",
        })
      );
      sheet.addRow(
        fullRow({
          Title: null,
          "Test Case ID": "TC003",
          Company: null,
          System: null,
          Module: null,
          "Issue Type": null,
        })
      );
      // Merge Title down all three data rows (column B, rows 2-4).
      sheet.mergeCells("B2:B4");
    });

    const result = await parseWorkbook(buffer);

    expect(result.fileErrors).toEqual([]);
    expect(result.rejected).toEqual([]);
    expect(result.tickets).toHaveLength(1);
    expect(result.tickets[0].title).toBe("FIX PARTNER DROPDOWN");
    expect(result.tickets[0].testCases).toHaveLength(3);
  });

  it("matches headers by name, not position", async () => {
    const reordered = [...HEADERS].reverse();
    const buffer = await toBuffer(
      (sheet) => {
        sheet.addRow([...fullRow()].reverse());
      },
      reordered
    );

    const result = await parseWorkbook(buffer);

    expect(result.fileErrors).toEqual([]);
    expect(result.tickets[0].title).toBe("FIX PARTNER DROPDOWN");
    expect(result.tickets[0].testCases[0].tcNumber).toBe("TC001");
  });

  it("skips a banner row above the header", async () => {
    const buffer = await toBuffer(
      (sheet) => {
        sheet.addRow(["QA Test Case Tracker — July"]);
        sheet.addRow(HEADERS);
        sheet.addRow(fullRow());
      },
      []
    );

    const result = await parseWorkbook(buffer);

    expect(result.fileErrors).toEqual([]);
    expect(result.tickets).toHaveLength(1);
    // Row numbers are the real sheet rows, so error messages point at the
    // right place even with a banner above the header.
    expect(result.tickets[0].testCases[0].rowNumber).toBe(3);
  });

  it("ignores blank spacer rows between tickets", async () => {
    const buffer = await toBuffer((sheet) => {
      sheet.addRow(fullRow());
      sheet.addRow([]);
      sheet.addRow(fullRow({ Title: "SECOND TICKET" }));
    });

    const result = await parseWorkbook(buffer);

    expect(result.rejected).toEqual([]);
    expect(result.tickets.map((t) => t.title)).toEqual([
      "FIX PARTNER DROPDOWN",
      "SECOND TICKET",
    ]);
  });

  it("skips rows that hold a value but aren't test cases", async () => {
    const buffer = await toBuffer((sheet) => {
      sheet.addRow(fullRow());
      // A trailing row carrying only a counter — no Test Case ID, Description,
      // or Status. Treating it as a test case would produce six bogus
      // "field is required" errors and reject the whole ticket.
      sheet.addRow(fullRow({ Title: null, "Test Case ID": null, Page: null, Description: null, Priority: null, "Expected Result": null, Status: null, "Ticket Status": null, "Failed Counter": 1, Date: null, "Lakbay Tester's": null, DEVS: null, "Test ID": null, Company: null, System: null, Module: null, "Issue Type": null, "Actual Result": null, Comments: null }));
      sheet.addRow(fullRow({ Title: null, "Test Case ID": "TC002" }));
    });

    const result = await parseWorkbook(buffer);

    expect(result.fileErrors).toEqual([]);
    expect(result.rejected).toEqual([]);
    expect(result.skippedRowNumbers).toEqual([3]);
    expect(result.tickets).toHaveLength(1);
    expect(result.tickets[0].testCases.map((tc) => tc.tcNumber)).toEqual([
      "TC001",
      "TC002",
    ]);
  });

  it("finds the data sheet even when it isn't first", async () => {
    const workbook = new ExcelJS.Workbook();
    const guide = workbook.addWorksheet("Read me first");
    guide.addRow(["Fill in the Import sheet, then upload it."]);
    guide.addRow(["Priority must be HIGH, MEDIUM, or LOW."]);
    const data = workbook.addWorksheet("Import");
    data.addRow(HEADERS);
    data.addRow(fullRow());
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    const result = await parseWorkbook(buffer);

    expect(result.fileErrors).toEqual([]);
    expect(result.sheetName).toBe("Import");
    expect(result.tickets).toHaveLength(1);
  });

  it("prefers a sheet with data over an identical empty one", async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet("Template").addRow(HEADERS);
    const filled = workbook.addWorksheet("July");
    filled.addRow(HEADERS);
    filled.addRow(fullRow());
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    const result = await parseWorkbook(buffer);

    expect(result.sheetName).toBe("July");
    expect(result.tickets).toHaveLength(1);
  });

  it("names the sheet when a required column is missing", async () => {
    const withoutPriority = HEADERS.filter((header) => header !== "Priority");
    const buffer = await toBuffer((sheet) => {
      sheet.addRow(
        withoutPriority.map((header) =>
          header === "Title" ? "SOME TICKET" : "x"
        )
      );
    }, withoutPriority);

    const result = await readWorkbook(buffer);

    expect("fileErrors" in result).toBe(true);
    if (!("fileErrors" in result)) return;
    expect(result.fileErrors[0]).toContain("Priority");
  });

  it("reports a sheet with a header but no data", async () => {
    const buffer = await toBuffer(() => {});
    const result = await readWorkbook(buffer);

    expect("fileErrors" in result).toBe(true);
    if (!("fileErrors" in result)) return;
    expect(result.fileErrors[0]).toMatch(/no data rows/i);
  });

  it("reports a file that isn't a workbook at all", async () => {
    const result = await readWorkbook(Buffer.from("this is not a spreadsheet"));

    expect("fileErrors" in result).toBe(true);
    if (!("fileErrors" in result)) return;
    expect(result.fileErrors[0]).toMatch(/could not read/i);
  });

  it("reports an unrecognizable header row", async () => {
    const buffer = await toBuffer(
      (sheet) => {
        sheet.addRow(["a", "b", "c"]);
        sheet.addRow([1, 2, 3]);
      },
      []
    );

    const result = await readWorkbook(buffer);

    expect("fileErrors" in result).toBe(true);
    if (!("fileErrors" in result)) return;
    expect(result.fileErrors[0]).toMatch(/header row/i);
  });
});
