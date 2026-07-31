/**
 * Value-level normalizers for the Excel import.
 *
 * Every function here takes one raw cell value and returns either a valid
 * domain value or a message explaining why it isn't one. Nothing in this file
 * knows about rows, sheets, or the database.
 *
 * Policy: normalize aggressively (case, whitespace, punctuation, known
 * aliases), then REJECT anything still unrecognized. Unlike the old JSON
 * normalizer, an unknown company does not quietly become POTB — silent
 * defaults corrupt data without telling anyone.
 */
import type {
  Company,
  IssueType,
  TestCasePriority,
  TestCaseStatus,
  TicketStatus,
} from "@/lib/validations";

export type Normalized<T> =
  | { ok: true; value: T }
  | { ok: false; message: string };

const ok = <T>(value: T): Normalized<T> => ({ ok: true, value });
const fail = (message: string): Normalized<never> => ({ ok: false, message });

/**
 * Excel hands us strings, numbers, Dates, and rich-text/formula objects
 * depending on how the cell was authored. Flatten all of them to a string.
 */
export function cellToString(raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  if (typeof raw === "string") return raw.trim();
  if (typeof raw === "number" || typeof raw === "boolean") return String(raw);
  if (raw instanceof Date) return toIsoDate(raw);

  if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    // Formula cells carry the computed value in `result`.
    if ("result" in obj) return cellToString(obj.result);
    if ("text" in obj) return cellToString(obj.text);
    // Rich text: { richText: [{ text }, ...] }. Join the runs raw and trim
    // once at the end — trimming each run would swallow the spaces between
    // them, turning "Verify " + "dropdown" into "Verifydropdown".
    if (Array.isArray(obj.richText)) {
      return obj.richText
        .map((part) => {
          const text = (part as { text?: unknown }).text;
          return typeof text === "string" ? text : cellToString(text);
        })
        .join("")
        .trim();
    }
    // Hyperlink cells: { hyperlink, text }
    if ("hyperlink" in obj) return cellToString(obj.hyperlink);
  }

  return String(raw).trim();
}

export function isBlank(raw: unknown): boolean {
  return cellToString(raw) === "";
}

/** Values the sheet uses to mean "nothing here": blank, "-", "N/A", "TBD". */
const PLACEHOLDER = /^(-+|n\/?a|none|tbd)$/i;

export function isBlankish(raw: unknown): boolean {
  const value = cellToString(raw);
  return value === "" || PLACEHOLDER.test(value);
}

/** Case-, whitespace-, and punctuation-insensitive comparison key. */
export function toKey(raw: unknown): string {
  return cellToString(raw)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Alias lookup shared by every enum field. Keys are already normalized by
 * toKey, so "Change Request", "change-request", and "CHANGE_REQUEST" all
 * collapse to the same entry.
 */
function lookup<T extends string>(
  raw: unknown,
  aliases: Record<string, T>,
  label: string
): Normalized<T> {
  const key = toKey(raw);
  if (key === "") return fail(`${label} is required`);

  const hit = aliases[key];
  if (hit) return ok(hit);

  return fail(`"${cellToString(raw)}" is not a valid ${label.toLowerCase()}`);
}

const COMPANY_ALIASES: Record<string, Company> = {
  POTB: "POTB",
  LAKBAYHUB_POTB: "POTB",
  LAKBAY_POTB: "POTB",
  LAKBAYHUB: "POTB",
  LAKBAY: "POTB",
  GLADEX: "GLADEX",
  LAKBAYHUB_GLADEX: "GLADEX",
  LAKBAY_GLADEX: "GLADEX",
};

export function normalizeCompany(raw: unknown): Normalized<Company> {
  return lookup(raw, COMPANY_ALIASES, "Company");
}

const ISSUE_TYPE_ALIASES: Record<string, IssueType> = {
  BUG: "BUG",
  BUG_FIX: "BUG",
  BUGFIX: "BUG",
  DEFECT: "BUG",
  FEATURE: "FEATURE",
  NEW_FEATURE: "FEATURE",
  FEATURE_REQUEST: "FEATURE",
  IMPROVEMENT: "IMPROVEMENT",
  ENHANCEMENT: "IMPROVEMENT",
  CHANGE_REQUEST: "CHANGE_REQUEST",
  CHANGE: "CHANGE_REQUEST",
  CR: "CHANGE_REQUEST",
};

export function normalizeIssueType(raw: unknown): Normalized<IssueType> {
  return lookup(raw, ISSUE_TYPE_ALIASES, "Issue Type");
}

/**
 * MEDIUM-HIGH resolves to HIGH: there is no fourth priority level, and a
 * medium-high item is closer to high than to medium. (The retired
 * scripts/normalize-import.cjs mapped it to MEDIUM.)
 */
const PRIORITY_ALIASES: Record<string, TestCasePriority> = {
  HIGH: "HIGH",
  CRITICAL: "HIGH",
  URGENT: "HIGH",
  MEDIUM_HIGH: "HIGH",
  HIGH_MEDIUM: "HIGH",
  MEDIUM: "MEDIUM",
  MED: "MEDIUM",
  NORMAL: "MEDIUM",
  MEDIUM_LOW: "MEDIUM",
  LOW: "LOW",
  MINOR: "LOW",
};

export function normalizePriority(raw: unknown): Normalized<TestCasePriority> {
  return lookup(raw, PRIORITY_ALIASES, "Priority");
}

const TEST_CASE_STATUS_ALIASES: Record<string, TestCaseStatus> = {
  PASSED: "PASSED",
  PASS: "PASSED",
  PASSES: "PASSED",
  OK: "PASSED",
  FAILED: "FAILED",
  FAIL: "FAILED",
  FAILS: "FAILED",
  IN_PROGRESS: "IN_PROGRESS",
  INPROGRESS: "IN_PROGRESS",
  ONGOING: "IN_PROGRESS",
  WIP: "IN_PROGRESS",
  TESTING: "IN_PROGRESS",
  PENDING: "PENDING",
  ON_HOLD: "ON_HOLD",
  HOLD: "ON_HOLD",
  ONHOLD: "ON_HOLD",
  BLOCKED: "ON_HOLD",
  NOT_TESTED: "NOT_TESTED",
  NOTTESTED: "NOT_TESTED",
  UNTESTED: "NOT_TESTED",
};

export function normalizeTestCaseStatus(
  raw: unknown
): Normalized<TestCaseStatus> {
  return lookup(raw, TEST_CASE_STATUS_ALIASES, "Status");
}

/** Ticket status has no NOT_TESTED — a ticket with untested cases is IN_PROGRESS. */
const TICKET_STATUS_ALIASES: Record<string, TicketStatus> = Object.fromEntries(
  Object.entries(TEST_CASE_STATUS_ALIASES).filter(
    ([, value]) => value !== "NOT_TESTED"
  )
) as Record<string, TicketStatus>;

export function normalizeTicketStatus(raw: unknown): Normalized<TicketStatus> {
  return lookup(raw, TICKET_STATUS_ALIASES, "Ticket Status");
}

/** Required free-text field: anything non-blank passes, blank is an error. */
export function normalizeRequiredText(
  raw: unknown,
  label: string
): Normalized<string> {
  const value = cellToString(raw);
  if (value === "") return fail(`${label} is required`);
  return ok(value);
}

/**
 * Optional free-text field. Blank is legitimately empty, so it becomes null
 * rather than an error. Placeholder dashes ("-", "N/A") are treated as blank
 * because that is what they mean in the sheet.
 */
export function normalizeOptionalText(raw: unknown): Normalized<string | null> {
  if (isBlankish(raw)) return ok(null);
  return ok(cellToString(raw));
}

function toIsoDate(date: Date): string {
  // The sheet's dates are calendar days, not instants. ExcelJS parses them as
  // UTC midnight, so read the UTC parts — using local getters would shift the
  // day backwards for anyone west of UTC.
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isRealDate(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const probe = new Date(Date.UTC(y, m - 1, d));
  return (
    probe.getUTCFullYear() === y &&
    probe.getUTCMonth() === m - 1 &&
    probe.getUTCDate() === d
  );
}

/**
 * Tested date. Accepts a real Excel date cell, YYYY-MM-DD, and the
 * MM/DD/YYYY that the sheet uses when the column was typed as text.
 * Blank is null; unparseable text is an error rather than a silent null, so a
 * typo'd date is not mistaken for "never tested".
 */
export function normalizeDate(raw: unknown): Normalized<string | null> {
  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) return fail("Date is not a valid date");
    return ok(toIsoDate(raw));
  }

  const value = cellToString(raw);
  if (isBlankish(value)) return ok(null);

  const iso = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const [, y, m, d] = iso;
    if (!isRealDate(+y, +m, +d)) return fail(`"${value}" is not a real date`);
    return ok(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`);
  }

  // US-style, which is how this sheet writes dates as text.
  const us = value.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (us) {
    const [, m, d, y] = us;
    if (!isRealDate(+y, +m, +d)) return fail(`"${value}" is not a real date`);
    return ok(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`);
  }

  // A very common fill-down typo: "7/252026" is 7/25/2026 with the second
  // slash missing. Don't guess it during real validation — say what it should
  // be and let the cleanup pass (which calls repairDateSeparator) apply it.
  const repaired = repairDateSeparator(value);
  if (repaired) {
    return fail(`"${value}" is missing a separator — write it as ${repaired}`);
  }

  return fail(`"${value}" is not a date in YYYY-MM-DD or MM/DD/YYYY format`);
}

/**
 * Detects the missing-separator date typo ("7/252026" for 7/25/2026) and
 * returns the date it unambiguously means, or null if the text doesn't match
 * that exact shape or isn't a real date once split. Used by normalizeDate to
 * build its rejection message, and by the cleanup pass to actually fix it —
 * this is the one date repair specific enough to apply automatically rather
 * than just describe.
 */
export function repairDateSeparator(value: string): string | null {
  const match = value.match(/^(\d{1,2})[/.-](\d{2})(\d{4})$/);
  if (!match) return null;
  const [, m, d, y] = match;
  if (!isRealDate(+y, +m, +d)) return null;
  return `${y}-${m.padStart(2, "0")}-${d}`;
}

/** Failed counter. Blank means zero; anything non-integer or negative fails. */
export function normalizeFailedCounter(raw: unknown): Normalized<number> {
  const value = cellToString(raw);
  if (value === "") return ok(0);

  if (!/^\d+$/.test(value)) {
    return fail(`"${value}" is not a non-negative whole number`);
  }

  return ok(Number(value));
}
