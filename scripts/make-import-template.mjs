/**
 * Generates import-template/qa-tracker-import-template.xlsx.
 *
 * Run: node scripts/make-import-template.mjs
 *
 * The workbook has two sheets:
 *   "Import"         headers only, with dropdowns — this is what gets uploaded
 *   "Allowed Values" reference, deliberately without importable headers
 *
 * The Import sheet is intentionally left empty. The importer prefers the first
 * sheet that has both a valid header row and data rows, so shipping example
 * rows here would mean an untouched template imports fake tickets.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";

const OUT_DIR = "import-template";
const OUT_FILE = "qa-tracker-import-template.xlsx";
const DATA_ROWS = 500;

/** Column definitions, in the order the tracker's sheet uses. */
const COLUMNS = [
  { header: "Test ID", width: 8, note: "Ignored by the importer." },
  { header: "Title", width: 44, note: "Ticket title. Repeat on every row of the ticket." },
  { header: "Test Case ID", width: 13, note: "Unique within the ticket, e.g. TC001." },
  { header: "Company", width: 11, list: ["POTB", "GLADEX"] },
  { header: "System", width: 18 },
  { header: "Module", width: 20 },
  { header: "Page", width: 26 },
  { header: "Description", width: 44 },
  { header: "Priority", width: 10, list: ["HIGH", "MEDIUM", "LOW"] },
  {
    header: "Issue Type",
    width: 16,
    list: ["BUG", "FEATURE", "IMPROVEMENT", "CHANGE_REQUEST"],
  },
  { header: "Expected Result", width: 40 },
  { header: "Actual Result", width: 40 },
  { header: "Comments", width: 32 },
  {
    header: "Status",
    width: 13,
    list: ["PASSED", "FAILED", "IN_PROGRESS", "PENDING", "ON_HOLD", "NOT_TESTED"],
  },
  {
    header: "Ticket Status",
    width: 14,
    list: ["PASSED", "FAILED", "IN_PROGRESS", "PENDING", "ON_HOLD"],
  },
  { header: "Failed Counter", width: 13 },
  { header: "Date", width: 12, numFmt: "yyyy-mm-dd" },
  { header: "Lakbay Tester's", width: 16 },
  { header: "DEVS", width: 16 },
];

/** Rows for the reference sheet: [field, required, allowed, notes]. */
const REFERENCE = [
  ["Title", "Required", "Any text", "Repeat on every row of the ticket. A blank Title continues the ticket above."],
  ["Test Case ID", "Required", "Any text", "Must be unique within one ticket."],
  ["Company", "Required", "POTB, GLADEX", "LakbayHub/POTB is accepted and read as POTB."],
  ["System", "Required", "Any text", "Must be the same on every row of the ticket."],
  ["Module", "Required", "Any text", "Must be the same on every row of the ticket."],
  ["Page", "Required", "Any text", ""],
  ["Description", "Required", "Any text", ""],
  ["Priority", "Required", "HIGH, MEDIUM, LOW", "N/A and blank are rejected. MEDIUM-HIGH is read as HIGH."],
  ["Issue Type", "Required", "BUG, FEATURE, IMPROVEMENT, CHANGE_REQUEST", "Must be the same on every row of the ticket. 'Bug Fix' reads as BUG, 'Enhancement' as IMPROVEMENT, 'CR' as CHANGE_REQUEST."],
  ["Expected Result", "Required", "Any text", "Cannot be blank."],
  ["Actual Result", "Optional", "Any text", "Blank, -, or N/A means empty."],
  ["Comments", "Optional", "Any text", "Blank, -, or N/A means empty."],
  ["Status", "Required", "PASSED, FAILED, IN_PROGRESS, PENDING, ON_HOLD, NOT_TESTED", "Pass/Fail/Hold/WIP/Ongoing are accepted."],
  ["Ticket Status", "Optional", "PASSED, FAILED, IN_PROGRESS, PENDING, ON_HOLD", "Leave blank to let the tracker compute it from the test case statuses. NOT_TESTED is not valid here."],
  ["Failed Counter", "Optional", "0 or a positive whole number", "May differ per row; the highest value in the ticket is used. Blank means 0."],
  ["Date", "Optional", "YYYY-MM-DD, MM/DD/YYYY, or a real date cell", "Blank means not yet tested. A malformed date is rejected, not ignored."],
  ["Lakbay Tester's", "Required", "Any text", "Must be the same on every row of the ticket."],
  ["DEVS", "Optional", "Any text", "Must be the same on every row of the ticket."],
  ["Test ID", "Ignored", "—", "Read and discarded."],
];

const RULES = [
  "One row per test case. A ticket spans as many rows as it has test cases.",
  "Repeat the ticket-level values (Title, Company, System, Module, Issue Type, Ticket Status, Lakbay Tester's, DEVS) on every row of the ticket. Merged cells and blank continuation rows also work, but repeating is the least error-prone.",
  "Every row of one ticket must agree on those ticket-level values. Failed Counter is the exception — it may differ per row.",
  "Keep all rows of one ticket together. The same Title split into two separate blocks is rejected.",
  "A row with no Test Case ID, Description, or Status is skipped as a note, and reported in the preview.",
  "Column order does not matter — headers are matched by name.",
];

const HEADER_FILL = "FF1E293B";
const HEADER_FONT = "FFF8FAFC";

function styleHeaderRow(row) {
  row.font = { bold: true, color: { argb: HEADER_FONT } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
  row.alignment = { vertical: "middle", horizontal: "left" };
  row.height = 22;
}

function buildImportSheet(workbook) {
  const sheet = workbook.addWorksheet("Import", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = COLUMNS.map((column) => ({
    header: column.header,
    key: column.header,
    width: column.width,
  }));

  styleHeaderRow(sheet.getRow(1));

  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: COLUMNS.length },
  };

  COLUMNS.forEach((column, index) => {
    const colNumber = index + 1;

    if (column.numFmt) {
      sheet.getColumn(colNumber).numFmt = column.numFmt;
    }

    if (!column.list) return;

    // Dropdowns on the empty rows, so the values are picked rather than typed.
    for (let rowNumber = 2; rowNumber <= DATA_ROWS + 1; rowNumber++) {
      sheet.getCell(rowNumber, colNumber).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [`"${column.list.join(",")}"`],
        showErrorMessage: true,
        errorStyle: "warning",
        errorTitle: `${column.header} must be one of the listed values`,
        error: column.list.join(", "),
      };
    }
  });

  COLUMNS.forEach((column, index) => {
    if (!column.note) return;
    sheet.getCell(1, index + 1).note = column.note;
  });

  return sheet;
}

function buildReferenceSheet(workbook) {
  // Header names here are deliberately unlike the import columns so the
  // importer never mistakes this sheet for the data sheet.
  const sheet = workbook.addWorksheet("Allowed Values");

  sheet.columns = [
    { header: "Field", width: 18 },
    { header: "Required?", width: 12 },
    { header: "Allowed values", width: 52 },
    { header: "Notes", width: 78 },
  ];

  styleHeaderRow(sheet.getRow(1));

  for (const entry of REFERENCE) {
    const row = sheet.addRow(entry);
    row.alignment = { vertical: "top", wrapText: true };
  }

  sheet.addRow([]);
  const rulesHeading = sheet.addRow(["Rules"]);
  rulesHeading.font = { bold: true };

  for (const rule of RULES) {
    const row = sheet.addRow(["", "", "", rule]);
    row.alignment = { vertical: "top", wrapText: true };
  }

  return sheet;
}

async function main() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "QA Tracker";
  workbook.description =
    "Import template for the QA tracker. Fill in the Import sheet and upload it.";

  buildImportSheet(workbook);
  buildReferenceSheet(workbook);

  await mkdir(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, OUT_FILE);
  await writeFile(outPath, Buffer.from(await workbook.xlsx.writeBuffer()));

  console.log(`WROTE ${outPath}`);
}

main().catch((err) => {
  console.error("FAILED:", err.message);
  process.exit(1);
});
