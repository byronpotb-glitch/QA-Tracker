/**
 * Guards the shipped template against drifting from the importer.
 *
 * If a column is renamed or a required column added in parse-excel.ts without
 * regenerating import-template/qa-tracker-import-template.xlsx, this fails.
 * Regenerate with: node scripts/make-import-template.mjs
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { parseWorkbook, readWorkbook } from "@/lib/import/parse-excel";

const TEMPLATE_PATH = path.join(
  process.cwd(),
  "import-template",
  "qa-tracker-import-template.xlsx"
);

/** The template as a plain ArrayBuffer, which is what both readers take. */
async function templateBytes(): Promise<ArrayBuffer> {
  const file = await readFile(TEMPLATE_PATH);
  return file.buffer.slice(
    file.byteOffset,
    file.byteOffset + file.byteLength
  ) as ArrayBuffer;
}

async function loadTemplate(): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await templateBytes());
  return workbook;
}

describe("the shipped import template", () => {
  it("has an Import sheet the importer recognizes but no data yet", async () => {
    const result = await readWorkbook(await templateBytes());

    // An untouched template must not import anything — the error names the
    // sheet, which is only possible if its header row was matched in full.
    expect("fileErrors" in result).toBe(true);
    if (!("fileErrors" in result)) return;
    expect(result.fileErrors[0]).toContain("Import");
    expect(result.fileErrors[0]).toMatch(/no data rows/i);
  });

  it("imports cleanly once a row is filled in", async () => {
    const workbook = await loadTemplate();
    const sheet = workbook.getWorksheet("Import");
    if (!sheet) throw new Error("template has no Import sheet");

    const headers = sheet.getRow(1).values as unknown[];
    const columnOf = (header: string) => {
      const index = headers.findIndex((value) => value === header);
      if (index === -1) throw new Error(`template is missing "${header}"`);
      return index;
    };

    const values: Record<string, unknown> = {
      "Test ID": 1,
      Title: "IMPLEMENT QUICKBOOKS INVOICE",
      "Test Case ID": "TC001",
      Company: "POTB",
      System: "LakbayHub/POTB",
      Module: "Invoicing",
      Page: "Invoice - Create",
      Description: "Verify an invoice syncs to QuickBooks on creation.",
      Priority: "HIGH",
      "Issue Type": "FEATURE",
      "Expected Result": "Invoice appears in QuickBooks within a minute.",
      "Actual Result": "Appeared immediately.",
      Comments: "Verified against sandbox.",
      Status: "PASSED",
      "Ticket Status": "PASSED",
      "Failed Counter": 0,
      Date: "2026-07-25",
      "Lakbay Tester's": "Byron",
      DEVS: "Arsh",
    };

    const row = sheet.getRow(2);
    for (const [header, value] of Object.entries(values)) {
      row.getCell(columnOf(header)).value = value as ExcelJS.CellValue;
    }
    row.commit();

    const result = await parseWorkbook(
      Buffer.from(await workbook.xlsx.writeBuffer())
    );

    expect(result.fileErrors).toEqual([]);
    expect(result.rejected).toEqual([]);
    expect(result.sheetName).toBe("Import");
    expect(result.tickets).toHaveLength(1);
    expect(result.tickets[0]).toMatchObject({
      title: "IMPLEMENT QUICKBOOKS INVOICE",
      company: "POTB",
      issueType: "FEATURE",
      ticketStatus: "PASSED",
      tester: "Byron",
      dev: "Arsh",
    });
    expect(result.tickets[0].testCases[0]).toMatchObject({
      tcNumber: "TC001",
      priority: "HIGH",
      status: "PASSED",
      testedDate: "2026-07-25",
    });
  });

  it("keeps the reference sheet unimportable, so it can't shadow the data", async () => {
    const workbook = await loadTemplate();
    const reference = workbook.getWorksheet("Allowed Values");
    if (!reference) throw new Error("template has no Allowed Values sheet");

    // Its headers must not look like import columns, or a template with an
    // empty Import sheet would try to import the documentation.
    const solo = new ExcelJS.Workbook();
    const copy = solo.addWorksheet("Allowed Values");
    reference.eachRow((row, rowNumber) => {
      copy.getRow(rowNumber).values = row.values as ExcelJS.CellValue[];
    });

    const result = await readWorkbook(
      Buffer.from(await solo.xlsx.writeBuffer())
    );

    expect("fileErrors" in result).toBe(true);
    if (!("fileErrors" in result)) return;
    expect(result.fileErrors[0]).toMatch(/header row/i);
  });
});
