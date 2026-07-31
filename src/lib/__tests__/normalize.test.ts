import { describe, expect, it } from "vitest";
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
  toKey,
} from "@/lib/import/normalize";

/** Unwraps a successful normalization, failing the test if it errored. */
function value<T>(result: { ok: true; value: T } | { ok: false; message: string }): T {
  if (!result.ok) throw new Error(`expected ok, got: ${result.message}`);
  return result.value;
}

describe("cellToString", () => {
  it("flattens the cell shapes ExcelJS produces", () => {
    expect(cellToString("  Booking  ")).toBe("Booking");
    expect(cellToString(3)).toBe("3");
    expect(cellToString(null)).toBe("");
    expect(cellToString(undefined)).toBe("");
    expect(cellToString({ result: "PASSED" })).toBe("PASSED");
    expect(cellToString({ text: "TC001", hyperlink: "http://x" })).toBe("TC001");
    expect(
      cellToString({ richText: [{ text: "Verify " }, { text: "dropdown" }] })
    ).toBe("Verify dropdown");
  });

  it("renders a date cell as an ISO calendar day", () => {
    expect(cellToString(new Date(Date.UTC(2026, 6, 9)))).toBe("2026-07-09");
  });
});

describe("toKey", () => {
  it("collapses case, spaces, and punctuation", () => {
    expect(toKey("Change Request")).toBe("CHANGE_REQUEST");
    expect(toKey("change-request")).toBe("CHANGE_REQUEST");
    expect(toKey("  CHANGE_REQUEST ")).toBe("CHANGE_REQUEST");
    expect(toKey("Lakbay Tester's")).toBe("LAKBAY_TESTER_S");
  });
});

describe("isBlankish", () => {
  it("treats sheet placeholders as empty", () => {
    for (const raw of ["", "  ", "-", "--", "N/A", "n/a", "NA", "none", "TBD"]) {
      expect(isBlankish(raw)).toBe(true);
    }
    expect(isBlankish("Byron")).toBe(false);
    expect(isBlankish(0)).toBe(false);
  });
});

describe("normalizeCompany", () => {
  it("accepts the two companies and their sheet spellings", () => {
    expect(value(normalizeCompany("POTB"))).toBe("POTB");
    expect(value(normalizeCompany("potb"))).toBe("POTB");
    expect(value(normalizeCompany("LakbayHub/POTB"))).toBe("POTB");
    expect(value(normalizeCompany("Gladex"))).toBe("GLADEX");
  });

  it("rejects an unknown company instead of defaulting to POTB", () => {
    const result = normalizeCompany("ACME");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("ACME");
  });

  it("reports blank as required", () => {
    const result = normalizeCompany("");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/required/i);
  });
});

describe("normalizeIssueType", () => {
  it("maps the sheet's spellings", () => {
    expect(value(normalizeIssueType("Bug Fix"))).toBe("BUG");
    expect(value(normalizeIssueType("BUG"))).toBe("BUG");
    expect(value(normalizeIssueType("Enhancement"))).toBe("IMPROVEMENT");
    expect(value(normalizeIssueType("Change Request"))).toBe("CHANGE_REQUEST");
    expect(value(normalizeIssueType("CR"))).toBe("CHANGE_REQUEST");
    expect(value(normalizeIssueType("feature"))).toBe("FEATURE");
  });

  it("rejects an unknown issue type instead of defaulting to FEATURE", () => {
    expect(normalizeIssueType("REGRESSION").ok).toBe(false);
  });
});

describe("normalizePriority", () => {
  it("resolves MEDIUM-HIGH upward to HIGH", () => {
    expect(value(normalizePriority("MEDIUM-HIGH"))).toBe("HIGH");
    expect(value(normalizePriority("Medium High"))).toBe("HIGH");
  });

  it("maps the plain levels and their abbreviations", () => {
    expect(value(normalizePriority("high"))).toBe("HIGH");
    expect(value(normalizePriority("Med"))).toBe("MEDIUM");
    expect(value(normalizePriority("LOW"))).toBe("LOW");
    expect(value(normalizePriority("Critical"))).toBe("HIGH");
  });

  it("rejects N/A and blank rather than defaulting to LOW", () => {
    expect(normalizePriority("N/A").ok).toBe(false);
    expect(normalizePriority("").ok).toBe(false);
  });
});

describe("normalizeTestCaseStatus", () => {
  it("maps the sheet's status spellings", () => {
    expect(value(normalizeTestCaseStatus("Pass"))).toBe("PASSED");
    expect(value(normalizeTestCaseStatus("FAILED"))).toBe("FAILED");
    expect(value(normalizeTestCaseStatus("On Hold"))).toBe("ON_HOLD");
    expect(value(normalizeTestCaseStatus("ongoing"))).toBe("IN_PROGRESS");
    expect(value(normalizeTestCaseStatus("WIP"))).toBe("IN_PROGRESS");
    expect(value(normalizeTestCaseStatus("Not Tested"))).toBe("NOT_TESTED");
  });

  it("rejects an unknown status instead of defaulting to NOT_TESTED", () => {
    expect(normalizeTestCaseStatus("SKIPPED").ok).toBe(false);
  });
});

describe("normalizeTicketStatus", () => {
  it("accepts the five ticket statuses", () => {
    expect(value(normalizeTicketStatus("passed"))).toBe("PASSED");
    expect(value(normalizeTicketStatus("In Progress"))).toBe("IN_PROGRESS");
    expect(value(normalizeTicketStatus("Pending"))).toBe("PENDING");
  });

  it("rejects NOT_TESTED, which only test cases can be", () => {
    expect(normalizeTicketStatus("NOT_TESTED").ok).toBe(false);
  });
});

describe("normalizeRequiredText / normalizeOptionalText", () => {
  it("requires non-blank text for required fields", () => {
    expect(value(normalizeRequiredText(" Booking ", "Page"))).toBe("Booking");
    const result = normalizeRequiredText("   ", "Page");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toBe("Page is required");
  });

  it("turns blanks and placeholders into null for optional fields", () => {
    expect(value(normalizeOptionalText(""))).toBeNull();
    expect(value(normalizeOptionalText("-"))).toBeNull();
    expect(value(normalizeOptionalText("N/A"))).toBeNull();
    expect(value(normalizeOptionalText("Works now"))).toBe("Works now");
  });
});

describe("normalizeDate", () => {
  it("accepts a real Excel date cell without shifting the day", () => {
    expect(value(normalizeDate(new Date(Date.UTC(2026, 6, 9))))).toBe("2026-07-09");
  });

  it("accepts ISO and US text dates", () => {
    expect(value(normalizeDate("2026-07-09"))).toBe("2026-07-09");
    expect(value(normalizeDate("2026-7-9"))).toBe("2026-07-09");
    expect(value(normalizeDate("07/09/2026"))).toBe("2026-07-09");
    expect(value(normalizeDate("7/9/2026"))).toBe("2026-07-09");
  });

  it("treats blank as not-yet-tested", () => {
    expect(value(normalizeDate(""))).toBeNull();
    expect(value(normalizeDate("-"))).toBeNull();
  });

  it("rejects unparseable and impossible dates rather than nulling them", () => {
    expect(normalizeDate("July 9").ok).toBe(false);
    expect(normalizeDate("2026-13-01").ok).toBe(false);
    expect(normalizeDate("02/30/2026").ok).toBe(false);
  });
});

describe("normalizeFailedCounter", () => {
  it("defaults blank to zero", () => {
    expect(value(normalizeFailedCounter(""))).toBe(0);
  });

  it("accepts whole numbers as text or numbers", () => {
    expect(value(normalizeFailedCounter(3))).toBe(3);
    expect(value(normalizeFailedCounter("2"))).toBe(2);
  });

  it("rejects negatives and non-numbers", () => {
    expect(normalizeFailedCounter("-1").ok).toBe(false);
    expect(normalizeFailedCounter("two").ok).toBe(false);
    expect(normalizeFailedCounter("1.5").ok).toBe(false);
  });
});
