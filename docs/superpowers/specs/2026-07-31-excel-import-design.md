# Excel Import — Design

**Date:** 2026-07-31
**Status:** Approved

## Problem

Import only accepts a hand-pasted JSON payload for one ticket at a time. The
real source of truth is a spreadsheet where each row is a test case and each
ticket spans several rows. Getting that sheet into the tracker today means
converting it to JSON by hand, one ticket per paste.

Re-importing is also destructive-by-omission: there is no way to say "this
sheet is the current state, sync it." Every import creates a new ticket, so an
updated sheet produces duplicates.

## Goal

Upload the `.xlsx` directly. Every ticket in the sheet lands in one pass. A
second upload of an updated sheet updates what changed and leaves the rest
alone.

## Sheet format

19 columns, header row first, one row per test case:

| Column | Maps to | Level |
| --- | --- | --- |
| Test ID | *ignored* | — |
| Title | `tickets.title` | ticket |
| Test Case ID | `test_cases.tc_number` | test case |
| Company | `tickets.company` | ticket |
| System | `tickets.system` | ticket |
| Module | `tickets.module` | ticket |
| Page | `test_cases.page` | test case |
| Description | `test_cases.description` | test case |
| Priority | `test_cases.priority` | test case |
| Issue Type | `tickets.issueType` | ticket |
| Expected Result | `test_cases.expectedResult` | test case |
| Actual Result | `test_cases.actualResult` | test case |
| Comments | `test_cases.comments` | test case |
| Status | `test_cases.status` | test case |
| Ticket Status | `tickets.ticketStatus` | ticket |
| Failed Counter | `tickets.failedCounter` | ticket |
| Date | `test_cases.testedDate` | test case |
| Lakbay Tester's | `tickets.tester`, `test_cases.tester` | ticket |
| DEVS | `tickets.dev` | ticket |

Test ID is ignored: in the real sheet it is `1` on every row, so it carries no
information.

Header matching is by normalized name (case-, space-, and punctuation-
insensitive), not position, so column order in the file does not matter. A
missing required column is a whole-file error.

## Grouping rows into tickets

**A row with a non-empty Title starts a new ticket. A row with a blank Title
continues the ticket above it.**

Merged cells read as filled: ExcelJS returns the master cell's value for every
cell in a merge range, so a Title merged down four rows yields the same title
on all four. Both conventions therefore work, and a sheet mixing them works
too.

A blank Title before any titled row is an error — there is no ticket to attach
it to.

## Value normalization

Compare case-, whitespace-, and punctuation-insensitively, then match against
an explicit alias table.

| Field | Accepts | Rejects |
| --- | --- | --- |
| Company | `POTB`, `GLADEX`; `LakbayHub/POTB` → POTB | anything else |
| Issue Type | `BUG`/`Bug Fix` → BUG, `FEATURE`, `IMPROVEMENT`/`ENHANCEMENT`, `CHANGE REQUEST`/`CR` | anything else |
| Priority | `HIGH`, `MEDIUM`/`MED`, `LOW`; `MEDIUM-HIGH` → HIGH | `N/A`, blank, anything else |
| Status | the 6 test-case statuses; `PASS` → PASSED, `FAIL` → FAILED, `HOLD` → ON_HOLD, `WIP`/`ONGOING` → IN_PROGRESS | anything else |
| Ticket Status | the 5 ticket statuses (no NOT_TESTED), same aliases | anything else |
| Date | `YYYY-MM-DD`, `MM/DD/YYYY`, a real Excel date cell | unparseable text |
| Failed Counter | non-negative integer, blank → 0 | negatives, non-numeric |

`MEDIUM-HIGH → HIGH` is deliberate: a medium-high priority is closer to high
than to medium, and the tracker has no fourth level. This differs from
`scripts/normalize-import.cjs`, which mapped it to MEDIUM.

**Ambiguous values are rejected, not defaulted.** Every error names its cell
(`Row 42, column Priority (I42): "N/A" is not a valid priority`). The old JSON
normalizer silently defaulted unknown companies to POTB and unknown priorities
to LOW, which quietly corrupted data; that behavior is not carried over.

Blank Actual Result / Comments / Date are legitimately empty, and become NULL.

## Ticket-level conflicts

A ticket's rows must agree on every ticket-level field after normalization.
If row 3 says BUG and row 5 says FEATURE for the same ticket, that ticket is
rejected with both cell addresses. Blank continuation cells do not count as
disagreement — only two different non-blank values do.

## Reconciliation against existing data

Match on `(title, company)`, which is what identifies a ticket in the sheet.
Within a matched ticket, match test cases on `tc_number`.

Every parsed ticket lands in one of three buckets:

- **New** — no match in the DB. Insert ticket + all test cases.
- **Will update** — matched, and at least one field differs. Apply only the
  changed fields.
- **Unchanged** — matched, nothing differs. Skip entirely; no write, no
  `updated_at` bump.

### What counts as a change

Result fields — **Status, Actual Result, Comments, Date** — are the live state
of a test run and are updated from the sheet.

Definition fields — **Page, Description, Expected Result, Priority** — describe
what the test *is*. A difference here is surfaced as a warning in the preview
and **not** written, because the tracker may hold a deliberately edited
description that the sheet has not caught up with.

Ticket-level fields (System, Module, Issue Type, Ticket Status, Failed Counter,
Tester, Dev) are updated from the sheet. Because Ticket Status and Failed
Counter come straight from the sheet, an updated ticket gets
`manual_override = true` so the rollup does not immediately recompute over the
imported value.

### History

When a matched test case's **Status** changes, snapshot the pre-import row into
`test_case_history` at `round = max(existing round) + 1` before overwriting it.
Only Status transitions trigger a snapshot; an edited comment on an unchanged
status does not. This mirrors what Retest already does.

### Rows missing from the sheet

A test case in the DB with no matching row in the sheet is **never deleted** —
the sheet may be a partial export. The preview counts them so the omission is
visible.

## Partial import

Valid tickets import; rejected tickets are listed with their errors and left
out. A single bad cell in one ticket does not block the other 28. The whole
apply runs in one transaction, so it either lands completely or not at all.

## Components

All parsing and diffing is pure and unit-testable; nothing in these three files
touches the database or ExcelJS beyond the initial cell read.

- **`src/lib/import/normalize.ts`** — value-level normalizers. Each takes a raw
  cell value and returns `{ ok: true, value }` or `{ ok: false, message }`.
  No I/O, no knowledge of rows or sheets.
- **`src/lib/import/parse-excel.ts`** — `readSheet(buffer)` turns the workbook
  into raw rows with cell addresses (the only ExcelJS-aware function);
  `parseRows(rows)` groups them into tickets, normalizes, checks ticket-level
  agreement, and returns `{ tickets, errors }`.
- **`src/lib/import/reconcile.ts`** — `reconcile(parsed, existing)` returns the
  new / will-update / unchanged buckets, per-field change lists, definition
  warnings, and missing-row counts. Takes plain data, returns plain data.
- **`src/app/(dashboard)/import/actions.ts`** — `previewExcelImport(formData)`
  reads the upload and existing tickets, returns the reconciliation report.
  `applyExcelImport(plan)` re-parses the uploaded file server-side and writes
  in one transaction. The client never sends back the write plan it was shown,
  so a tampered payload cannot widen the write.
- **`src/app/(dashboard)/import/page.tsx`** — upload → preview → confirm.

## Retiring JSON import

The JSON path is removed, not kept alongside: `parseImportText`,
`buildImportPreview`, `validateImportPayload`, `importSchema`, the
`importTicket` action, the JSON textarea UI, `parse-import.test.ts`, and
`scripts/normalize-import.cjs` (which existed only to feed that path).

`ticketInputSchema` and `testCaseInputSchema` stay — the manual create/edit
forms use them.

## Testing

Unit tests, no DB:

- `normalize.ts` — each alias table entry, each rejection, Excel date cells,
  blank handling.
- `parse-excel.ts` — grouping by blank Title, grouping by merged Title, blank
  Title with no preceding ticket, ticket-level disagreement, missing required
  column, header order independence, partial validity.
- `reconcile.ts` — new/updated/unchanged classification, result-field change
  detection, definition-field warning without write, history trigger on status
  change only, missing-row counting.
