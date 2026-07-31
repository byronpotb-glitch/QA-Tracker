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
missing required column is a whole-file error. The header row is found by
scanning the first 10 rows for one that matches at least 6 known columns, so a
banner row above the header is skipped rather than breaking the import.

Every visible sheet is scanned, and the first one with a complete header row
*and* at least one data row wins. That lets a workbook carry instruction or
lookup sheets alongside the data, and it means the shipped template — whose
`Import` sheet starts empty — reports "no data rows" instead of importing its
own documentation. The sheet actually used is named in the preview.

A row that holds a value but has no Test Case ID, no Description, and no Status
is not a test case — it is a stray note, a trailing counter, or an overflowing
comment. Those rows are skipped and their row numbers reported in the preview.
Treating them as test cases produced six "field is required" errors each and
buried the real problems.

## Grouping rows into tickets

**A row with a non-empty Title starts a new ticket. A row with a blank Title
continues the ticket above it.**

Merged cells read as filled: ExcelJS returns the master cell's value for every
cell in a merge range, so a Title merged down four rows yields the same title
on all four. Both conventions therefore work, and a sheet mixing them works
too.

A blank Title before any titled row is an error — there is no ticket to attach
it to. A title that reappears in a *separate* block, after a different ticket,
is also an error: two blocks would compete for one `(title, company)` identity
and there is no way to know which the tracker should reconcile against. Blank
spacer rows between tickets are ignored.

A Test Case ID repeated within one ticket is an error for the same reason —
reconciliation matches on it, so it has to be unique.

## Value normalization

Compare case-, whitespace-, and punctuation-insensitively, then match against
an explicit alias table.

| Field | Accepts | Rejects |
| --- | --- | --- |
| Company | `POTB`, `GLADEX`; `LakbayHub/POTB` → POTB | anything else |
| Issue Type | `BUG`/`Bug Fix` → BUG, `FEATURE`, `IMPROVEMENT`/`ENHANCEMENT`, `CHANGE REQUEST`/`CR` | anything else |
| Priority | `HIGH`, `MEDIUM`/`MED`, `LOW`; `MEDIUM-HIGH` → HIGH | `N/A`, blank, anything else |
| Status | the 6 test-case statuses; `PASS` → PASSED, `FAIL` → FAILED, `HOLD` → ON_HOLD, `WIP`/`ONGOING` → IN_PROGRESS | anything else |
| Ticket Status | the 5 ticket statuses (no NOT_TESTED), same aliases; blank is allowed | `NOT_TESTED`, anything else |
| Date | `YYYY-MM-DD`, `MM/DD/YYYY`, a real Excel date cell | unparseable or impossible dates |
| Failed Counter | non-negative integer, blank → 0 | negatives, non-numeric, decimals |

A date with a missing separator — `7/252026`, a common fill-down typo — is
rejected with the correction spelled out (`write it as 2026-07-25`) rather than
guessed at.

`MEDIUM-HIGH → HIGH` is deliberate: a medium-high priority is closer to high
than to medium, and the tracker has no fourth level. This differs from
`scripts/normalize-import.cjs`, which mapped it to MEDIUM.

**Ambiguous values are rejected, not defaulted.** Every error names its cell
(`Row 42, column Priority (I42): "N/A" is not a valid priority`). The old JSON
normalizer silently defaulted unknown companies to POTB and unknown priorities
to LOW, which quietly corrupted data; that behavior is not carried over.

Blank Actual Result / Comments / Date are legitimately empty, and become NULL.
So do the placeholders the sheet uses to mean nothing — `-`, `N/A`, `none`,
`TBD` — which is what they mean in practice.

## Ticket-level conflicts

A ticket's rows must agree on every ticket-level field after normalization.
If row 3 says BUG and row 5 says FEATURE for the same ticket, that ticket is
rejected with both cell addresses. Blank and placeholder continuation cells do
not count as disagreement — only two different real values do.

**Failed Counter is exempt from the agreement rule.** The real sheet fills it in
per test case, so rows legitimately disagree — one test case failing twice does
not make its neighbours wrong. The ticket stores one number, and the highest
value across the ticket's rows is the meaningful one. Each cell must still be a
valid non-negative integer.

**Ticket Status is the one optional ticket-level field.** When the sheet leaves
it blank for every row of a ticket, the tracker's own rollup decides the status
from the test case statuses and `manual_override` stays off, so the ticket keeps
being managed automatically. When the sheet does assert a status, that value
wins and `manual_override` is set. This means a blank Ticket Status column never
reads as "reset every ticket to PENDING".

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

Ticket-level fields (System, Module, Issue Type, Tester, Dev) are updated from
the sheet. Ticket Status and Failed Counter are written only when the sheet
asserts a status, and in that case `manual_override` is set to true so the
rollup does not immediately recompute over the imported value. Otherwise the
rollup runs after the writes land, as it does everywhere else in the app.

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
`ticketInputSchema`'s optional `ticket_status` / `failed_counter` fields go too
— they existed only so the JSON payload could backfill historical tickets.

`ticketInputSchema` and `testCaseInputSchema` themselves stay — the manual
create/edit forms use them.

The rollup helper that `importTicket` shared with the ticket actions moves out
of the server-action file to `src/lib/recompute-rollup.ts`, so both the ticket
actions and the import can call it without it becoming a server-action
endpoint.

## Testing

Unit tests, no DB:

- `normalize.ts` — each alias table entry, each rejection, Excel date cells,
  blank and placeholder handling.
- `parse-excel.ts` — grouping by blank Title, grouping by repeated Title,
  Title with no preceding ticket, duplicate title blocks, duplicate Test Case
  ID, ticket-level disagreement, partial validity.
- `read-workbook.ts` — real `.xlsx` buffers built with ExcelJS and read back:
  actually-merged Title cells, reversed column order, a banner row above the
  header, blank spacer rows, missing required column, a non-workbook file.
- `reconcile.ts` — new/updated/unchanged classification, result-field change
  detection, definition-field warning without write, history trigger on status
  change only, missing-row counting, and the optional-Ticket-Status behavior.

- `import-template.ts` — the shipped template is loaded from disk, confirmed to
  report "no data rows" while empty, filled with one row and confirmed to import,
  and its reference sheet confirmed unimportable. This fails if a column is
  renamed in the importer without regenerating the template.

The database write path in `actions.ts` is covered by types and the existing
transaction patterns, not by tests — there is no test database in this project.

## Template

`import-template/qa-tracker-import-template.xlsx`, generated by
`scripts/make-import-template.mjs`, is the file users fill in. The `Import`
sheet carries the 19 headers, frozen and filtered, with dropdowns on the five
enum columns and an ISO date format on Date. A second `Allowed Values` sheet
documents every rule, with headers deliberately unlike the import columns so it
can never be mistaken for the data sheet.

`import-template/AI-CONVERSION-PROMPT.md` is a pasteable prompt that turns a
messy source sheet into this format — every allowed value, every alias, and
explicit instructions for the cases the importer rejects (mixed Issue Type per
ticket, `N/A` priority, blank Expected Result, malformed dates, non-test-case
rows).

## Addendum: in-app cleanup (2026-07-31)

The AI-conversion prompt above requires pasting the sheet into an external AI.
Added an in-app "Clean up file" step that does the same job for the subset of
problems that have exactly one correct fix, with no AI call and no invented
data.

**Scope, decided explicitly:** deterministic fixes only. Auto-fixes:

- Alias spelling and case (`Bug Fix` → `BUG`, `Pass` → `PASSED`,
  `LakbayHub/POTB` → `POTB`)
- The missing-separator date typo (`7/252026` → `2026-07-25`) — the one date
  repair specific enough to apply rather than just describe
- A duplicate Test Case ID within a ticket, renumbered `-2`, `-3`, …
- A blank or non-conflicting ticket-level cell, filled down from the ticket's
  single agreed value (including Title casing, once grouping has already
  established which rows belong together)
- Stray non-test-case rows, already dropped by `readWorkbook`

Left alone and reported instead, never guessed at:

- Two different values for the same ticket-level field across its rows (e.g.
  Issue Type) — each row keeps its own normalized value; one issue is
  reported per conflicting field, not per row
- A required field that's blank everywhere in the ticket
- A value that doesn't normalize at all (e.g. `N/A` priority) — kept as-is
  and flagged, even when every other row of the ticket agrees on something,
  since inferring from neighbors would be a guess dressed up as a fix

**Implementation (`src/lib/import/cleanup.ts`):** reuses `readWorkbook` and
`groupRows` from `parse-excel.ts` rather than re-parsing the sheet a different
way, and every enum normalizer from `normalize.ts` wrapped to a single
`Normalized<string>` shape so ticket-level and per-row fields can share one
code path. `cleanupParsedRows` is pure (same split as parse-excel.ts);
`buildCleanedWorkbook` is the only new ExcelJS-writing code, producing a
single `Import`-sheet workbook matching the template's column order.

One easy-to-miss distinction the tests caught: "blank" means different things
for a ticket-level fill-down field (`-`/`N/A` on a continuation row means
"same as above", matching `resolveTicketField`'s existing rule) versus a
per-row field (`N/A` in Priority is not blank, it's an invalid value — exactly
what `normalizePriority` already rejects). Using the loose blank check for
both meant an unrecognized per-row value like `N/A` was silently swallowed as
if the cell were empty instead of being flagged. Ticket-level fields use
`isBlankish` before normalizing; per-row fields call `normalize()` directly on
the raw value with no pre-check, exactly mirroring `parse-excel.ts`'s
`readCell`.

**UI:** a "Clean up file" button next to Preview/Apply. On success the cleaned
file becomes the active selection — Preview and Apply operate on it directly,
no manual re-upload — and a report shows every fix applied, everything still
needing a manual edit (with cell addresses), and a "Download cleaned file"
button for anyone who wants to save or hand-edit the corrected sheet first.
Cleanup never touches the database — it's pure file-in, file-out — so running
it carries no risk beyond wasted time if the sheet was already fine.
