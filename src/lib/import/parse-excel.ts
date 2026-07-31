/**
 * Turns the QA tracker spreadsheet into tickets.
 *
 * Two stages, split so the hard part is testable without a workbook:
 *   readWorkbook(buffer) -> SheetRow[]   (the only ExcelJS-aware code)
 *   parseRows(rows)      -> ParseResult  (pure)
 *
 * Sheet shape: one row per test case, 19 columns. Ticket-level values repeat
 * (or are merged/blank) across the rows belonging to one ticket.
 */
import ExcelJS from "exceljs";
import type {
  Company,
  IssueType,
  TestCasePriority,
  TestCaseStatus,
  TicketStatus,
} from "@/lib/validations";
import {
  cellToString,
  isBlank,
  isBlankish,
  normalizeCompany,
  normalizeDate,
  normalizeFailedCounter,
  normalizeIssueType,
  normalizeOptionalText,
  normalizePriority,
  normalizeRequiredText,
  normalizeTestCaseStatus,
  normalizeTicketStatus,
  toKey,
  type Normalized,
} from "./normalize";

export type ColumnKey =
  | "testId"
  | "title"
  | "tcNumber"
  | "company"
  | "system"
  | "module"
  | "page"
  | "description"
  | "priority"
  | "issueType"
  | "expectedResult"
  | "actualResult"
  | "comments"
  | "status"
  | "ticketStatus"
  | "failedCounter"
  | "date"
  | "tester"
  | "dev";

export interface ColumnSpec {
  key: ColumnKey;
  /** Header text shown in error messages. */
  label: string;
  /** Accepted header spellings, as toKey() outputs. */
  aliases: string[];
  /** A missing required column makes the whole file unusable. */
  required: boolean;
}

/**
 * Headers are matched by normalized name, not position, so reordering columns
 * in the sheet doesn't break the import. "Test ID" is read and discarded — in
 * the real sheet it is 1 on every row.
 */
export const COLUMN_SPECS: ColumnSpec[] = [
  { key: "testId", label: "Test ID", aliases: ["TEST_ID"], required: false },
  { key: "title", label: "Title", aliases: ["TITLE", "TICKET_TITLE"], required: true },
  {
    key: "tcNumber",
    label: "Test Case ID",
    aliases: ["TEST_CASE_ID", "TC_ID", "TC_NUMBER", "TC"],
    required: true,
  },
  { key: "company", label: "Company", aliases: ["COMPANY"], required: true },
  { key: "system", label: "System", aliases: ["SYSTEM"], required: true },
  { key: "module", label: "Module", aliases: ["MODULE"], required: true },
  { key: "page", label: "Page", aliases: ["PAGE"], required: true },
  {
    key: "description",
    label: "Description",
    aliases: ["DESCRIPTION", "TEST_DESCRIPTION"],
    required: true,
  },
  { key: "priority", label: "Priority", aliases: ["PRIORITY"], required: true },
  {
    key: "issueType",
    label: "Issue Type",
    aliases: ["ISSUE_TYPE", "TYPE"],
    required: true,
  },
  {
    key: "expectedResult",
    label: "Expected Result",
    aliases: ["EXPECTED_RESULT", "EXPECTED"],
    required: true,
  },
  {
    key: "actualResult",
    label: "Actual Result",
    aliases: ["ACTUAL_RESULT", "ACTUAL"],
    required: false,
  },
  {
    key: "comments",
    label: "Comments",
    aliases: ["COMMENTS", "COMMENT", "REMARKS"],
    required: false,
  },
  {
    key: "status",
    label: "Status",
    aliases: ["STATUS", "TEST_CASE_STATUS", "TC_STATUS"],
    required: true,
  },
  {
    key: "ticketStatus",
    label: "Ticket Status",
    aliases: ["TICKET_STATUS"],
    required: false,
  },
  {
    key: "failedCounter",
    label: "Failed Counter",
    aliases: ["FAILED_COUNTER", "FAILED_COUNT", "RECURRING"],
    required: false,
  },
  {
    key: "date",
    label: "Date",
    aliases: ["DATE", "TESTED_DATE", "DATE_TESTED"],
    required: false,
  },
  {
    key: "tester",
    label: "Lakbay Tester's",
    aliases: ["LAKBAY_TESTER_S", "LAKBAY_TESTERS", "LAKBAY_TESTER", "TESTER"],
    required: true,
  },
  {
    key: "dev",
    label: "DEVS",
    aliases: ["DEVS", "DEV", "DEVELOPER", "DEVELOPERS"],
    required: false,
  },
];

export const COLUMN_LABELS = Object.fromEntries(
  COLUMN_SPECS.map((spec) => [spec.key, spec.label])
) as Record<ColumnKey, string>;

export interface SheetCell {
  value: unknown;
  /** Excel address, e.g. "I42" — quoted back to the user in errors. */
  address: string;
}

export interface SheetRow {
  rowNumber: number;
  cells: Partial<Record<ColumnKey, SheetCell>>;
}

export interface ImportIssue {
  rowNumber: number;
  /** Cell address, when the problem is a specific cell. */
  cell?: string;
  column?: string;
  message: string;
}

export interface ParsedTestCase {
  tcNumber: string;
  page: string;
  description: string;
  priority: TestCasePriority;
  expectedResult: string;
  actualResult: string | null;
  comments: string | null;
  status: TestCaseStatus;
  testedDate: string | null;
  /** Where this test case came from, for the preview. */
  rowNumber: number;
}

export interface ParsedTicket {
  title: string;
  company: Company;
  system: string;
  module: string;
  issueType: IssueType;
  /**
   * Null when the sheet leaves Ticket Status blank for every row of this
   * ticket. Null means "let the rollup decide"; a value means the sheet is
   * asserting a status, which freezes it via manualOverride.
   */
  ticketStatus: TicketStatus | null;
  failedCounter: number;
  tester: string;
  dev: string | null;
  testCases: ParsedTestCase[];
  firstRow: number;
  lastRow: number;
}

export interface RejectedTicket {
  /** Best-effort title; "(untitled)" if even that couldn't be read. */
  title: string;
  firstRow: number;
  lastRow: number;
  issues: ImportIssue[];
}

export interface ParseResult {
  tickets: ParsedTicket[];
  rejected: RejectedTicket[];
  /** Problems with the file itself — no tickets can be read at all. */
  fileErrors: string[];
  /**
   * Rows that held something but weren't test cases (stray notes, trailing
   * counters). Reported rather than silently dropped.
   */
  skippedRowNumbers: number[];
  /** Which sheet the data was read from; null when parsing rows directly. */
  sheetName: string | null;
}

/** A contiguous block of rows sharing one Title. */
export interface RowGroup {
  title: string;
  titleCell: string;
  rows: SheetRow[];
}

// ---------------------------------------------------------------------------
// Stage 1: workbook -> rows
// ---------------------------------------------------------------------------

/** How far down to look for the header row before giving up. */
const HEADER_SEARCH_DEPTH = 10;
/** A candidate header row must match at least this many known columns. */
const HEADER_MIN_MATCHES = 6;

export interface ReadResult {
  rows: SheetRow[];
  skippedRowNumbers: number[];
  sheetName: string;
}

export async function readWorkbook(
  buffer: ArrayBuffer | Buffer
): Promise<ReadResult | { fileErrors: string[] }> {
  const workbook = new ExcelJS.Workbook();

  try {
    await workbook.xlsx.load(buffer as ArrayBuffer);
  } catch {
    return {
      fileErrors: [
        "Could not read the file as an Excel workbook. Save it as .xlsx and try again.",
      ],
    };
  }

  const candidates =
    workbook.worksheets.filter((sheet) => sheet.state !== "hidden") ??
    workbook.worksheets;

  if (candidates.length === 0) {
    return { fileErrors: ["The workbook has no visible sheets."] };
  }

  // Scan every sheet rather than assuming the first one holds the data, so a
  // workbook with instruction or lookup sheets alongside the data still works.
  let incomplete: { name: string; missing: string[] } | null = null;
  let empty: string | null = null;

  for (const worksheet of candidates) {
    if (worksheet.rowCount === 0) continue;

    const header = findHeaderRow(worksheet);
    if ("error" in header) continue;

    const missing = COLUMN_SPECS.filter(
      (spec) => spec.required && header.columns[spec.key] === undefined
    );
    if (missing.length > 0) {
      incomplete ??= {
        name: worksheet.name,
        missing: missing.map((spec) => spec.label),
      };
      continue;
    }

    const read = readSheetRows(worksheet, header);
    if (read.rows.length === 0) {
      empty ??= worksheet.name;
      continue;
    }

    return { ...read, sheetName: worksheet.name };
  }

  if (incomplete) {
    return {
      fileErrors: [
        `Sheet "${incomplete.name}" is missing required ` +
          `column${incomplete.missing.length > 1 ? "s" : ""}: ` +
          incomplete.missing.join(", "),
      ],
    };
  }

  if (empty) {
    return {
      fileErrors: [`Sheet "${empty}" has a header row but no data rows.`],
    };
  }

  return {
    fileErrors: [
      "Could not find a sheet with the expected header row. The header should " +
        "have columns like Title, Test Case ID, Company, Priority, Status.",
    ],
  };
}

function readSheetRows(
  worksheet: ExcelJS.Worksheet,
  header: { rowNumber: number; columns: Partial<Record<ColumnKey, number>> }
): { rows: SheetRow[]; skippedRowNumbers: number[] } {
  const rows: SheetRow[] = [];
  const skippedRowNumbers: number[] = [];

  for (
    let rowNumber = header.rowNumber + 1;
    rowNumber <= worksheet.rowCount;
    rowNumber++
  ) {
    const row = worksheet.getRow(rowNumber);
    const cells: Partial<Record<ColumnKey, SheetCell>> = {};
    let hasValue = false;

    for (const [key, colNumber] of Object.entries(header.columns)) {
      if (colNumber === undefined) continue;
      // For a merged range ExcelJS returns the master's value from every cell
      // in the range, so a Title merged down four rows reads as filled on all
      // four. Blank-continuation sheets and merged sheets both work.
      const cell = row.getCell(colNumber);
      cells[key as ColumnKey] = { value: cell.value, address: cell.address };
      if (!isBlank(cell.value)) hasValue = true;
    }

    // Spacer rows between tickets carry no information.
    if (!hasValue) continue;

    // A row can hold a value — a stray note, a trailing counter, an overflowing
    // comment — without being a test case. Without Test Case ID, Description,
    // AND Status there is nothing to import, and treating it as a test case
    // would bury the real errors under a wall of "field is required".
    if (!looksLikeTestCase(cells)) {
      skippedRowNumbers.push(rowNumber);
      continue;
    }

    rows.push({ rowNumber, cells });
  }

  return { rows, skippedRowNumbers };
}

/** The three cells that make a row a test case rather than a stray note. */
function looksLikeTestCase(
  cells: Partial<Record<ColumnKey, SheetCell>>
): boolean {
  return (
    !isBlankish(cells.tcNumber?.value) ||
    !isBlankish(cells.description?.value) ||
    !isBlankish(cells.status?.value)
  );
}

function findHeaderRow(
  worksheet: ExcelJS.Worksheet
):
  | { rowNumber: number; columns: Partial<Record<ColumnKey, number>> }
  | { error: string } {
  const depth = Math.min(HEADER_SEARCH_DEPTH, worksheet.rowCount);

  for (let rowNumber = 1; rowNumber <= depth; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    const columns: Partial<Record<ColumnKey, number>> = {};
    let matches = 0;

    for (let col = 1; col <= worksheet.columnCount; col++) {
      const key = toKey(row.getCell(col).value);
      if (key === "") continue;

      const spec = COLUMN_SPECS.find((candidate) =>
        candidate.aliases.includes(key)
      );
      // First match wins, so a duplicated header column doesn't shadow the
      // original.
      if (spec && columns[spec.key] === undefined) {
        columns[spec.key] = col;
        matches++;
      }
    }

    if (matches >= HEADER_MIN_MATCHES) return { rowNumber, columns };
  }

  return {
    error:
      "Could not find the header row. The first row of data should be a header " +
      "with columns like Title, Test Case ID, Company, Status.",
  };
}

// ---------------------------------------------------------------------------
// Stage 2: rows -> tickets (pure)
// ---------------------------------------------------------------------------

export function parseRows(rows: SheetRow[]): ParseResult {
  const base = { skippedRowNumbers: [], sheetName: null };

  if (rows.length === 0) {
    return {
      ...base,
      tickets: [],
      rejected: [],
      fileErrors: ["The sheet has no data rows."],
    };
  }

  const grouped = groupRows(rows);
  const tickets: ParsedTicket[] = [];
  const rejected: RejectedTicket[] = [...grouped.rejected];
  const seenTitles = new Map<string, RowGroup>();

  for (const group of grouped.groups) {
    const firstRow = group.rows[0].rowNumber;
    const lastRow = group.rows[group.rows.length - 1].rowNumber;

    // The same title in two separate blocks can't be reconciled — we'd have
    // two candidate tickets competing for one (title, company) identity.
    const duplicateOf = seenTitles.get(group.title.toUpperCase());
    if (duplicateOf) {
      rejected.push({
        title: group.title,
        firstRow,
        lastRow,
        issues: [
          {
            rowNumber: firstRow,
            cell: group.titleCell,
            column: COLUMN_LABELS.title,
            message:
              `"${group.title}" also appears at row ` +
              `${duplicateOf.rows[0].rowNumber}. Put all rows for one ticket ` +
              `together in a single block.`,
          },
        ],
      });
      continue;
    }
    seenTitles.set(group.title.toUpperCase(), group);

    const parsed = parseGroup(group);
    if ("issues" in parsed) {
      rejected.push({ title: group.title, firstRow, lastRow, issues: parsed.issues });
    } else {
      tickets.push(parsed.ticket);
    }
  }

  return { ...base, tickets, rejected, fileErrors: [] };
}

/**
 * A row with a non-blank Title starts a ticket; a row with a blank Title
 * continues the one above. Consecutive rows with the same title also belong
 * together, which is what a merged Title cell looks like after ExcelJS
 * resolves the merge.
 */
export function groupRows(rows: SheetRow[]): {
  groups: RowGroup[];
  rejected: RejectedTicket[];
} {
  const groups: RowGroup[] = [];
  const rejected: RejectedTicket[] = [];
  let current: RowGroup | null = null;
  let orphans: SheetRow[] = [];

  for (const row of rows) {
    const titleCell = row.cells.title;
    const title = cellToString(titleCell?.value);

    if (title === "") {
      if (current) {
        current.rows.push(row);
      } else {
        // A continuation row before any titled row has no ticket to join.
        orphans.push(row);
      }
      continue;
    }

    if (current && current.title.toUpperCase() === title.toUpperCase()) {
      current.rows.push(row);
      continue;
    }

    current = { title, titleCell: titleCell?.address ?? "", rows: [row] };
    groups.push(current);
  }

  if (orphans.length > 0) {
    rejected.push({
      title: "(untitled)",
      firstRow: orphans[0].rowNumber,
      lastRow: orphans[orphans.length - 1].rowNumber,
      issues: orphans.map((row) => ({
        rowNumber: row.rowNumber,
        cell: row.cells.title?.address,
        column: COLUMN_LABELS.title,
        message: "Row has no Title and no ticket above it to belong to.",
      })),
    });
    orphans = [];
  }

  return { groups, rejected };
}

function parseGroup(
  group: RowGroup
): { ticket: ParsedTicket } | { issues: ImportIssue[] } {
  const issues: ImportIssue[] = [];

  const title = normalizeRequiredText(group.title, COLUMN_LABELS.title);
  const company = resolveTicketField(group, "company", normalizeCompany, issues, true);
  const system = resolveTicketField(
    group,
    "system",
    (raw) => normalizeRequiredText(raw, COLUMN_LABELS.system),
    issues,
    true
  );
  const moduleName = resolveTicketField(
    group,
    "module",
    (raw) => normalizeRequiredText(raw, COLUMN_LABELS.module),
    issues,
    true
  );
  const issueType = resolveTicketField(
    group,
    "issueType",
    normalizeIssueType,
    issues,
    true
  );
  const tester = resolveTicketField(
    group,
    "tester",
    (raw) => normalizeRequiredText(raw, COLUMN_LABELS.tester),
    issues,
    true
  );
  const ticketStatus = resolveTicketField(
    group,
    "ticketStatus",
    normalizeTicketStatus,
    issues,
    false
  );
  const failedCounter = resolveMaxFailedCounter(group, issues);
  const dev = resolveTicketField(
    group,
    "dev",
    (raw) => normalizeRequiredText(raw, COLUMN_LABELS.dev),
    issues,
    false
  );

  const testCases: ParsedTestCase[] = [];
  const seenTcNumbers = new Map<string, number>();

  for (const row of group.rows) {
    const parsed = parseTestCaseRow(row, issues);
    if (!parsed) continue;

    const dupeRow = seenTcNumbers.get(parsed.tcNumber.toUpperCase());
    if (dupeRow !== undefined) {
      issues.push({
        rowNumber: row.rowNumber,
        cell: row.cells.tcNumber?.address,
        column: COLUMN_LABELS.tcNumber,
        message: `"${parsed.tcNumber}" is already used by row ${dupeRow} of this ticket.`,
      });
      continue;
    }
    seenTcNumbers.set(parsed.tcNumber.toUpperCase(), row.rowNumber);
    testCases.push(parsed);
  }

  if (testCases.length === 0 && issues.length === 0) {
    issues.push({
      rowNumber: group.rows[0].rowNumber,
      message: "Ticket has no readable test case rows.",
    });
  }

  if (
    issues.length > 0 ||
    !title.ok ||
    !company.ok ||
    !system.ok ||
    !moduleName.ok ||
    !issueType.ok ||
    !tester.ok ||
    !ticketStatus.ok ||
    !failedCounter.ok ||
    !dev.ok
  ) {
    if (issues.length === 0 && !title.ok) {
      issues.push({
        rowNumber: group.rows[0].rowNumber,
        cell: group.titleCell,
        column: COLUMN_LABELS.title,
        message: title.message,
      });
    }
    return { issues };
  }

  return {
    ticket: {
      title: title.value,
      company: company.value,
      system: system.value,
      module: moduleName.value,
      issueType: issueType.value,
      ticketStatus: ticketStatus.value,
      failedCounter: failedCounter.value,
      tester: tester.value,
      dev: dev.value,
      testCases,
      firstRow: group.rows[0].rowNumber,
      lastRow: group.rows[group.rows.length - 1].rowNumber,
    },
  };
}

/**
 * Reads one ticket-level field across every row of the ticket.
 *
 * All non-blank cells must normalize to the same value: a ticket that says BUG
 * on row 3 and FEATURE on row 5 is a data error, not something to guess at.
 * Blank continuation cells are silent — only two different non-blank values
 * disagree.
 */
function resolveTicketField<T>(
  group: RowGroup,
  key: ColumnKey,
  normalize: (raw: unknown) => Normalized<T>,
  issues: ImportIssue[],
  required: true
): { ok: true; value: T } | { ok: false };
function resolveTicketField<T>(
  group: RowGroup,
  key: ColumnKey,
  normalize: (raw: unknown) => Normalized<T>,
  issues: ImportIssue[],
  required: false
): { ok: true; value: T | null } | { ok: false };
function resolveTicketField<T>(
  group: RowGroup,
  key: ColumnKey,
  normalize: (raw: unknown) => Normalized<T>,
  issues: ImportIssue[],
  required: boolean
): { ok: true; value: T | null } | { ok: false } {
  const label = COLUMN_LABELS[key];
  let resolved: { value: T; cell?: string; rowNumber: number } | null = null;
  let failed = false;

  for (const row of group.rows) {
    const cell = row.cells[key];
    // Blank and placeholder cells ("-", "N/A") mean "same as the row above",
    // not a competing value.
    if (!cell || isBlankish(cell.value)) continue;

    const normalized = normalize(cell.value);
    if (!normalized.ok) {
      issues.push({
        rowNumber: row.rowNumber,
        cell: cell.address,
        column: label,
        message: normalized.message,
      });
      failed = true;
      continue;
    }

    if (resolved === null) {
      resolved = {
        value: normalized.value,
        cell: cell.address,
        rowNumber: row.rowNumber,
      };
      continue;
    }

    if (normalized.value !== resolved.value) {
      issues.push({
        rowNumber: row.rowNumber,
        cell: cell.address,
        column: label,
        message:
          `${label} is "${String(normalized.value)}" here but ` +
          `"${String(resolved.value)}" at ${resolved.cell ?? `row ${resolved.rowNumber}`}. ` +
          `Every row of a ticket must agree.`,
      });
      failed = true;
    }
  }

  if (failed) return { ok: false };

  if (resolved === null) {
    if (required) {
      issues.push({
        rowNumber: group.rows[0].rowNumber,
        column: label,
        message: `${label} is missing for this ticket.`,
      });
      return { ok: false };
    }
    return { ok: true, value: null };
  }

  return { ok: true, value: resolved.value };
}

/**
 * Failed Counter is the one ticket-level column the sheet fills in per row —
 * it's a retry count per test case, so rows legitimately disagree. The ticket
 * stores a single number, and the highest is the meaningful one: a ticket that
 * had a test case fail twice is a twice-failed ticket.
 *
 * Every cell still has to be a valid non-negative integer; only the
 * "all rows must agree" rule is lifted.
 */
function resolveMaxFailedCounter(
  group: RowGroup,
  issues: ImportIssue[]
): { ok: true; value: number } | { ok: false } {
  let highest = 0;
  let failed = false;

  for (const row of group.rows) {
    const cell = row.cells.failedCounter;
    if (!cell || isBlankish(cell.value)) continue;

    const normalized = normalizeFailedCounter(cell.value);
    if (!normalized.ok) {
      issues.push({
        rowNumber: row.rowNumber,
        cell: cell.address,
        column: COLUMN_LABELS.failedCounter,
        message: normalized.message,
      });
      failed = true;
      continue;
    }

    highest = Math.max(highest, normalized.value);
  }

  return failed ? { ok: false } : { ok: true, value: highest };
}

/** Returns null when the row had errors; the errors are pushed onto `issues`. */
function parseTestCaseRow(
  row: SheetRow,
  issues: ImportIssue[]
): ParsedTestCase | null {
  const before = issues.length;

  const tcNumber = readCell(row, "tcNumber", issues, (raw) =>
    normalizeRequiredText(raw, COLUMN_LABELS.tcNumber)
  );
  const page = readCell(row, "page", issues, (raw) =>
    normalizeRequiredText(raw, COLUMN_LABELS.page)
  );
  const description = readCell(row, "description", issues, (raw) =>
    normalizeRequiredText(raw, COLUMN_LABELS.description)
  );
  const priority = readCell(row, "priority", issues, normalizePriority);
  const expectedResult = readCell(row, "expectedResult", issues, (raw) =>
    normalizeRequiredText(raw, COLUMN_LABELS.expectedResult)
  );
  const actualResult = readCell(row, "actualResult", issues, normalizeOptionalText);
  const comments = readCell(row, "comments", issues, normalizeOptionalText);
  const status = readCell(row, "status", issues, normalizeTestCaseStatus);
  const testedDate = readCell(row, "date", issues, normalizeDate);

  if (issues.length !== before) return null;

  return {
    tcNumber: tcNumber!,
    page: page!,
    description: description!,
    priority: priority!,
    expectedResult: expectedResult!,
    actualResult: actualResult ?? null,
    comments: comments ?? null,
    status: status!,
    testedDate: testedDate ?? null,
    rowNumber: row.rowNumber,
  };
}

function readCell<T>(
  row: SheetRow,
  key: ColumnKey,
  issues: ImportIssue[],
  normalize: (raw: unknown) => Normalized<T>
): T | undefined {
  const cell = row.cells[key];
  const normalized = normalize(cell?.value);

  if (!normalized.ok) {
    issues.push({
      rowNumber: row.rowNumber,
      cell: cell?.address,
      column: COLUMN_LABELS[key],
      message: normalized.message,
    });
    return undefined;
  }

  return normalized.value;
}

/** Convenience wrapper: read a workbook and parse it in one call. */
export async function parseWorkbook(
  buffer: ArrayBuffer | Buffer
): Promise<ParseResult> {
  const read = await readWorkbook(buffer);
  if ("fileErrors" in read) {
    return {
      tickets: [],
      rejected: [],
      fileErrors: read.fileErrors,
      skippedRowNumbers: [],
      sheetName: null,
    };
  }

  return {
    ...parseRows(read.rows),
    skippedRowNumbers: read.skippedRowNumbers,
    sheetName: read.sheetName,
  };
}

/** Human-readable location for an issue, e.g. "I42" or "row 42". */
export function issueLocation(issue: ImportIssue): string {
  return issue.cell ?? `row ${issue.rowNumber}`;
}
