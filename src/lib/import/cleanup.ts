/**
 * Auto-fixes a messy sheet into the shape the importer expects, and hands
 * back a corrected .xlsx.
 *
 * Deterministic only — this never invents data. It fixes things that have
 * exactly one correct interpretation (a typo'd date, a duplicate Test Case
 * ID, alias spelling, a stray non-test-case row) and fills a ticket's value
 * down onto every one of its rows once that value is unambiguous. Anything
 * genuinely missing or conflicting (blank Priority, two Issue Types on one
 * ticket) is left exactly as the sheet had it and reported as still needing
 * a manual fix — never guessed at.
 *
 * Two stages, same split as parse-excel.ts:
 *   cleanupWorkbook(buffer)   -> CleanupResult      (reads with readWorkbook)
 *   cleanupParsedRows(rows)   -> CleanupRowsResult   (pure)
 *   buildCleanedWorkbook(rows) -> Buffer             (the write-side ExcelJS code)
 */
import ExcelJS from "exceljs";
import {
  cellToString,
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
  repairDateSeparator,
  type Normalized,
} from "./normalize";
import {
  COLUMN_LABELS,
  COLUMN_SPECS,
  groupRows,
  readWorkbook,
  type ColumnKey,
  type ImportIssue,
  type RowGroup,
  type SheetRow,
  issueLocation,
} from "./parse-excel";

export interface CleanupChange {
  rowNumber: number;
  cell?: string;
  column: string;
  from: string;
  to: string;
}

export interface CleanedRow {
  rowNumber: number;
  values: Partial<Record<ColumnKey, string | null>>;
}

export interface CleanupRowsResult {
  fixes: CleanupChange[];
  remainingIssues: ImportIssue[];
  rows: CleanedRow[];
}

export interface CleanupResult {
  fileErrors: string[];
  sheetName: string | null;
  fixes: CleanupChange[];
  remainingIssues: ImportIssue[];
  /** Rows dropped because they weren't test cases — no Test Case ID, Description, or Status. */
  removedRowNumbers: number[];
  rows: CleanedRow[];
}

/** Wraps any normalize.ts function into one returning a plain string, so every field can share one shape. Null becomes "" (blank). */
function asStringNormalizer<T>(
  normalize: (raw: unknown) => Normalized<T>
): (raw: unknown) => Normalized<string> {
  return (raw) => {
    const result = normalize(raw);
    if (!result.ok) return result;
    return { ok: true, value: result.value === null ? "" : String(result.value) };
  };
}

interface FieldSpec {
  key: ColumnKey;
  normalize: (raw: unknown) => Normalized<string>;
  required: boolean;
}

/**
 * Ticket-level fields: every row of a ticket must agree once normalized, and
 * an agreed value is filled onto every row (including ones that left it
 * blank), which is the bulk of what "convert to proper format" means here.
 */
const TICKET_LEVEL_FIELDS: FieldSpec[] = [
  { key: "company", normalize: asStringNormalizer(normalizeCompany), required: true },
  {
    key: "system",
    normalize: (raw) => normalizeRequiredText(raw, COLUMN_LABELS.system),
    required: true,
  },
  {
    key: "module",
    normalize: (raw) => normalizeRequiredText(raw, COLUMN_LABELS.module),
    required: true,
  },
  { key: "issueType", normalize: asStringNormalizer(normalizeIssueType), required: true },
  {
    key: "tester",
    normalize: (raw) => normalizeRequiredText(raw, COLUMN_LABELS.tester),
    required: true,
  },
  {
    key: "ticketStatus",
    normalize: asStringNormalizer(normalizeTicketStatus),
    required: false,
  },
  {
    key: "dev",
    normalize: (raw) => normalizeRequiredText(raw, COLUMN_LABELS.dev),
    required: false,
  },
];

/**
 * Per-row fields: no fill-down. Failed Counter lives here, not above — the
 * real sheet tracks it per test case, so rows legitimately differ, same as
 * the importer's own rule.
 */
const PER_ROW_FIELDS: FieldSpec[] = [
  {
    key: "page",
    normalize: (raw) => normalizeRequiredText(raw, COLUMN_LABELS.page),
    required: true,
  },
  {
    key: "description",
    normalize: (raw) => normalizeRequiredText(raw, COLUMN_LABELS.description),
    required: true,
  },
  { key: "priority", normalize: asStringNormalizer(normalizePriority), required: true },
  {
    key: "expectedResult",
    normalize: (raw) => normalizeRequiredText(raw, COLUMN_LABELS.expectedResult),
    required: true,
  },
  {
    key: "actualResult",
    normalize: asStringNormalizer(normalizeOptionalText),
    required: false,
  },
  { key: "comments", normalize: asStringNormalizer(normalizeOptionalText), required: false },
  { key: "status", normalize: asStringNormalizer(normalizeTestCaseStatus), required: true },
  { key: "date", normalize: asStringNormalizer(makeDateNormalizer()), required: false },
  {
    key: "failedCounter",
    normalize: asStringNormalizer(normalizeFailedCounter),
    required: false,
  },
];

/**
 * Date gets one extra deterministic repair on top of normalizeDate: the
 * missing-separator typo ("7/252026") has exactly one valid reading, so
 * cleanup applies it instead of just describing it in an error.
 */
function makeDateNormalizer(): (raw: unknown) => Normalized<string | null> {
  return (raw) => {
    if (typeof raw === "string") {
      const repaired = repairDateSeparator(raw.trim());
      if (repaired) return { ok: true, value: repaired };
    }
    return normalizeDate(raw);
  };
}

export function cleanupParsedRows(rows: SheetRow[]): CleanupRowsResult {
  const fixes: CleanupChange[] = [];
  const remainingIssues: ImportIssue[] = [];
  const outputByRow = new Map<number, CleanedRow>();
  for (const row of rows) {
    outputByRow.set(row.rowNumber, { rowNumber: row.rowNumber, values: {} });
  }

  if (rows.length === 0) return { fixes, remainingIssues, rows: [] };

  const { groups, rejected } = groupRows(rows);

  for (const rejection of rejected) {
    remainingIssues.push(...rejection.issues);
  }

  // Rows groupRows couldn't place in any ticket (a continuation row with
  // nothing above it) get their raw values carried through untouched — there
  // is no ticket context to normalize or fill down against.
  const groupedRowNumbers = new Set(groups.flatMap((g) => g.rows.map((r) => r.rowNumber)));
  for (const row of rows) {
    if (!groupedRowNumbers.has(row.rowNumber)) {
      passthroughRow(row, outputByRow.get(row.rowNumber)!);
    }
  }

  const seenTitles = new Map<string, RowGroup>();
  for (const group of groups) {
    const key = group.title.toUpperCase();
    const duplicateOf = seenTitles.get(key);

    if (duplicateOf) {
      // Two blocks claiming the same ticket can't be safely merged — which
      // block is authoritative isn't something cleanup can decide.
      remainingIssues.push({
        rowNumber: group.rows[0].rowNumber,
        cell: group.titleCell,
        column: COLUMN_LABELS.title,
        message:
          `"${group.title}" also appears at row ${duplicateOf.rows[0].rowNumber}. ` +
          `Put all rows for one ticket together in a single block, then clean up again.`,
      });
      for (const row of group.rows) passthroughRow(row, outputByRow.get(row.rowNumber)!);
      continue;
    }

    seenTitles.set(key, group);
    applyGroup(group, outputByRow, fixes, remainingIssues);
  }

  return {
    fixes,
    remainingIssues,
    rows: rows.map((row) => outputByRow.get(row.rowNumber)!),
  };
}

function passthroughRow(row: SheetRow, output: CleanedRow) {
  for (const spec of COLUMN_SPECS) {
    const raw = cellToString(row.cells[spec.key]?.value);
    output.values[spec.key] = raw === "" ? null : raw;
  }
}

function applyGroup(
  group: RowGroup,
  outputByRow: Map<number, CleanedRow>,
  fixes: CleanupChange[],
  remainingIssues: ImportIssue[]
) {
  const resolutions = new Map<ColumnKey, string | null>();
  for (const field of TICKET_LEVEL_FIELDS) {
    resolutions.set(
      field.key,
      resolveGroupField(group, field, remainingIssues)
    );
  }

  for (const row of group.rows) {
    const output = outputByRow.get(row.rowNumber)!;

    // Test ID is ignored by the importer; carry it through unchanged.
    const testIdRaw = cellToString(row.cells.testId?.value);
    output.values.testId = testIdRaw === "" ? null : testIdRaw;

    // Title is guaranteed consistent by how groups are formed (a new group
    // starts whenever the title differs, case-insensitively) — no conflict
    // is possible, so it's filled down directly rather than re-resolved.
    writeFieldValue(
      row,
      output,
      "title",
      group.title,
      (raw) => normalizeRequiredText(raw, COLUMN_LABELS.title),
      fixes,
      remainingIssues
    );

    for (const field of TICKET_LEVEL_FIELDS) {
      writeFieldValue(
        row,
        output,
        field.key,
        resolutions.get(field.key) ?? null,
        field.normalize,
        fixes,
        remainingIssues
      );
    }

    for (const field of PER_ROW_FIELDS) {
      writePerRowField(row, output, field.key, field.normalize, fixes, remainingIssues);
    }
  }

  applyTcNumbers(group, outputByRow, fixes, remainingIssues);
}

/**
 * Resolves one ticket-level field across every row of the group: a single
 * agreed non-blank value, or null when the rows disagree or none was given.
 * Disagreement and "missing" are reported here once per ticket rather than
 * per row; a cell that simply doesn't normalize is reported later, when that
 * row is written, so the message can point at the exact cell.
 */
function resolveGroupField(
  group: RowGroup,
  field: FieldSpec,
  remainingIssues: ImportIssue[]
): string | null {
  const label = COLUMN_LABELS[field.key];
  const goodValues: { value: string; cell?: string; rowNumber: number }[] = [];
  let anyNonBlank = false;

  for (const row of group.rows) {
    const cell = row.cells[field.key];
    if (!cell || isBlankish(cell.value)) continue;
    anyNonBlank = true;

    const normalized = field.normalize(cell.value);
    if (normalized.ok) {
      goodValues.push({ value: normalized.value, cell: cell.address, rowNumber: row.rowNumber });
    }
  }

  const distinct = [...new Set(goodValues.map((v) => v.value))];

  if (distinct.length > 1) {
    const first = goodValues.find((v) => v.value === distinct[0])!;
    const second = goodValues.find((v) => v.value === distinct[1])!;
    remainingIssues.push({
      rowNumber: second.rowNumber,
      cell: second.cell,
      column: label,
      message:
        `${label} is "${second.value}" here but "${first.value}" at ` +
        `${first.cell ?? `row ${first.rowNumber}`}. Every row of a ticket must ` +
        `agree — pick one and update the others in the sheet.`,
    });
    return null;
  }

  if (distinct.length === 1) return distinct[0];

  // No value normalized successfully anywhere. If something was there but
  // unreadable, that cell's own error is enough — don't also claim it's
  // "missing".
  if (field.required && !anyNonBlank) {
    remainingIssues.push({
      rowNumber: group.rows[0].rowNumber,
      column: label,
      message: `${label} is missing for this ticket.`,
    });
  }

  return null;
}

/**
 * Writes one ticket-level field of one row. `resolved` is the ticket's agreed
 * value (or null if the field is blank/conflicted/missing for this ticket).
 *
 * Blank and placeholder cells ("-", "N/A") mean "same as the row above" for a
 * ticket-level field — the same rule resolveGroupField uses — so they're
 * filled from `resolved` without ever being normalized or flagged.
 *
 * A cell that fails to normalize is never overwritten, even when the rest of
 * the ticket agrees on something — that would be guessing what a bad cell
 * meant. It's left as-is and reported.
 */
function writeFieldValue(
  row: SheetRow,
  output: CleanedRow,
  key: ColumnKey,
  resolved: string | null,
  normalize: (raw: unknown) => Normalized<string>,
  fixes: CleanupChange[],
  remainingIssues: ImportIssue[]
) {
  const cell = row.cells[key];
  const rawStr = cellToString(cell?.value);
  const blank = !cell || isBlankish(cell.value);

  let finalValue: string;

  if (blank) {
    finalValue = resolved ?? "";
  } else {
    const individually = normalize(cell!.value);
    if (individually.ok) {
      finalValue = resolved ?? individually.value;
    } else {
      finalValue = rawStr;
      remainingIssues.push({
        rowNumber: row.rowNumber,
        cell: cell!.address,
        column: COLUMN_LABELS[key],
        message: resolved
          ? `${individually.message} The rest of this ticket says "${resolved}" — check this cell.`
          : individually.message,
      });
    }
  }

  output.values[key] = finalValue === "" ? null : finalValue;

  if (rawStr !== finalValue && cell) {
    fixes.push({
      rowNumber: row.rowNumber,
      cell: cell.address,
      column: COLUMN_LABELS[key],
      from: rawStr === "" ? "—" : rawStr,
      to: finalValue === "" ? "—" : finalValue,
    });
  }
}

/**
 * Writes one per-row field (no ticket to fall back on). Unlike the
 * ticket-level version above, this never pre-filters "-"/"N/A" as blank —
 * whether that counts as blank is up to the field itself (normalizeOptionalText
 * treats it as empty; normalizePriority and the other required enum fields
 * correctly reject it as an unrecognized value). This mirrors exactly how
 * parse-excel.ts's readCell calls each normalizer, with no pre-check at all.
 */
function writePerRowField(
  row: SheetRow,
  output: CleanedRow,
  key: ColumnKey,
  normalize: (raw: unknown) => Normalized<string>,
  fixes: CleanupChange[],
  remainingIssues: ImportIssue[]
) {
  const cell = row.cells[key];
  const rawStr = cellToString(cell?.value);
  const normalized = normalize(cell?.value);

  let finalValue: string;
  if (normalized.ok) {
    finalValue = normalized.value;
  } else {
    finalValue = rawStr;
    remainingIssues.push({
      rowNumber: row.rowNumber,
      cell: cell?.address,
      column: COLUMN_LABELS[key],
      message: normalized.message,
    });
  }

  output.values[key] = finalValue === "" ? null : finalValue;

  if (rawStr !== finalValue && cell) {
    fixes.push({
      rowNumber: row.rowNumber,
      cell: cell.address,
      column: COLUMN_LABELS[key],
      from: rawStr === "" ? "—" : rawStr,
      to: finalValue === "" ? "—" : finalValue,
    });
  }
}

/**
 * Test Case ID gets its own pass: normalized like any required text field,
 * then deduplicated within the ticket by appending "-2", "-3", etc. — the one
 * fix in this file that changes what a cell means rather than just its
 * spelling, but it's fully deterministic (first occurrence keeps its name,
 * every later duplicate is unambiguously "the same ID, again").
 */
function applyTcNumbers(
  group: RowGroup,
  outputByRow: Map<number, CleanedRow>,
  fixes: CleanupChange[],
  remainingIssues: ImportIssue[]
) {
  const seen = new Map<string, number>();
  const label = COLUMN_LABELS.tcNumber;

  for (const row of group.rows) {
    const output = outputByRow.get(row.rowNumber)!;
    const cell = row.cells.tcNumber;
    const rawStr = cellToString(cell?.value);
    const normalized = normalizeRequiredText(cell?.value, label);

    if (!normalized.ok) {
      output.values.tcNumber = rawStr === "" ? null : rawStr;
      remainingIssues.push({
        rowNumber: row.rowNumber,
        cell: cell?.address,
        column: label,
        message: normalized.message,
      });
      continue;
    }

    let finalValue = normalized.value;
    if (finalValue !== rawStr && cell) {
      fixes.push({
        rowNumber: row.rowNumber,
        cell: cell.address,
        column: label,
        from: rawStr,
        to: finalValue,
      });
    }

    const dedupeKey = finalValue.toUpperCase();
    const count = seen.get(dedupeKey) ?? 0;
    if (count > 0) {
      const renamed = `${finalValue}-${count + 1}`;
      fixes.push({
        rowNumber: row.rowNumber,
        cell: cell?.address,
        column: label,
        from: finalValue,
        to: renamed,
      });
      finalValue = renamed;
    }
    seen.set(dedupeKey, count + 1);

    output.values.tcNumber = finalValue;
  }
}

// ---------------------------------------------------------------------------
// Workbook I/O
// ---------------------------------------------------------------------------

export async function cleanupWorkbook(buffer: ArrayBuffer | Buffer): Promise<CleanupResult> {
  const read = await readWorkbook(buffer);
  if ("fileErrors" in read) {
    return {
      fileErrors: read.fileErrors,
      sheetName: null,
      fixes: [],
      remainingIssues: [],
      removedRowNumbers: [],
      rows: [],
    };
  }

  const cleaned = cleanupParsedRows(read.rows);

  return {
    fileErrors: [],
    sheetName: read.sheetName,
    fixes: cleaned.fixes,
    remainingIssues: cleaned.remainingIssues,
    removedRowNumbers: read.skippedRowNumbers,
    rows: cleaned.rows,
  };
}

/** Writes the corrected rows to a fresh single-sheet workbook, template-shaped. */
export async function buildCleanedWorkbook(rows: CleanedRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Import", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = COLUMN_SPECS.map((spec) => ({
    header: spec.label,
    key: spec.key,
    width: Math.max(spec.label.length + 2, 12),
  }));
  sheet.getRow(1).font = { bold: true };
  sheet.getColumn("date").numFmt = "yyyy-mm-dd";

  for (const row of rows) {
    const values: Record<string, string | number | null> = {};
    for (const spec of COLUMN_SPECS) {
      const value = row.values[spec.key] ?? null;
      values[spec.key] =
        spec.key === "failedCounter" && value !== null ? Number(value) : value;
    }
    sheet.addRow(values);
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export { issueLocation };
