# Sheet → import format: prompt to paste

Copy everything between the `---` markers into an AI chat, then paste your
spreadsheet rows underneath it. Ask for the output as a table you can paste
straight into the `Import` sheet of `qa-tracker-import-template.xlsx`.

---

You are converting a QA test-case spreadsheet into a strict import format.
Output a table with exactly these 19 columns, in this order, with a header row:

`Test ID | Title | Test Case ID | Company | System | Module | Page | Description | Priority | Issue Type | Expected Result | Actual Result | Comments | Status | Ticket Status | Failed Counter | Date | Lakbay Tester's | DEVS`

## Structure

- **One row per test case.** A ticket spans as many rows as it has test cases.
- **Repeat every ticket-level value on every row of that ticket.** Do not leave
  them blank and do not merge cells. Ticket-level columns are: Title, Company,
  System, Module, Issue Type, Ticket Status, Lakbay Tester's, DEVS.
- **Every row of one ticket must carry identical values in those columns.** If
  the source disagrees — say one row says BUG and another says FEATURE — pick
  the single value that best describes the ticket as a whole and use it on all
  its rows. Do not preserve the disagreement.
- **Keep all rows of one ticket together**, in one contiguous block. Never split
  one Title into two blocks separated by another ticket.
- **Test Case ID must be unique within a ticket.** Renumber duplicates
  (TC001, TC002, …).
- **Drop rows that are not test cases.** If a source row has no test case
  identifier, no description, and no status — a stray note, a trailing counter,
  an overflowing comment — leave it out entirely.
- Put `1` in Test ID on every row. It is ignored.

## Column values

Use these exact spellings. Do not invent new values.

| Column | Required | Allowed values |
| --- | --- | --- |
| Title | yes | Any text. Uppercase is conventional. |
| Test Case ID | yes | Any text, unique within the ticket, e.g. `TC001` |
| Company | yes | `POTB` or `GLADEX` |
| System | yes | Any text |
| Module | yes | Any text |
| Page | yes | Any text |
| Description | yes | Any text |
| Priority | yes | `HIGH`, `MEDIUM`, or `LOW` |
| Issue Type | yes | `BUG`, `FEATURE`, `IMPROVEMENT`, or `CHANGE_REQUEST` |
| Expected Result | yes | Any text |
| Actual Result | no | Any text, or empty |
| Comments | no | Any text, or empty |
| Status | yes | `PASSED`, `FAILED`, `IN_PROGRESS`, `PENDING`, `ON_HOLD`, or `NOT_TESTED` |
| Ticket Status | no | `PASSED`, `FAILED`, `IN_PROGRESS`, `PENDING`, or `ON_HOLD` |
| Failed Counter | no | `0` or a positive whole number |
| Date | no | `YYYY-MM-DD`, or empty |
| Lakbay Tester's | yes | Any text |
| DEVS | no | Any text, or empty |

### Mapping the source's wording

- Company: `LakbayHub/POTB`, `Lakbay`, `POTB` → `POTB`. Anything Gladex → `GLADEX`.
- Issue Type: `Bug Fix`, `Defect` → `BUG`. `Enhancement` → `IMPROVEMENT`.
  `CR`, `Change` → `CHANGE_REQUEST`. `New Feature` → `FEATURE`.
- Priority: `Critical`, `Urgent`, `Medium-High` → `HIGH`. `Med`, `Normal` →
  `MEDIUM`. `Minor` → `LOW`.
- Status: `Pass` → `PASSED`. `Fail` → `FAILED`. `Hold`, `Blocked` → `ON_HOLD`.
  `WIP`, `Ongoing`, `Testing` → `IN_PROGRESS`. `Untested` → `NOT_TESTED`.

### Required fields that are empty in the source

These four cannot be left blank, and `N/A` / `-` / `TBD` count as blank:

- **Priority** — choose `HIGH`, `MEDIUM`, or `LOW` from how serious the test
  case reads. Default to `MEDIUM` if there is genuinely nothing to go on.
- **Expected Result** — write one sentence describing what should happen, derived
  from the Description. Never leave it empty and never write `N/A`.
- **Issue Type** — infer it from the Title. A title starting with "FIX" or
  describing something broken is a `BUG`; "IMPLEMENT" or "ADD" is a `FEATURE`;
  "ENHANCEMENT" or "IMPROVE" is an `IMPROVEMENT`.
- **Description**, **Page**, **Test Case ID**, **Title**, **Company**,
  **System**, **Module**, **Lakbay Tester's** — carry over from the source; if a
  ticket-level one is missing, reuse the value from another row of the same
  ticket.

### Dates

Output `YYYY-MM-DD` only. Fix malformed source dates rather than copying them:

- `7/25/2026` → `2026-07-25`
- `7/252026` → `2026-07-25` (a missing separator)
- `Jul 25, 2026` → `2026-07-25`
- blank, `-`, `N/A`, `TBD` → leave the cell empty

If a date is genuinely ambiguous, leave it empty rather than guessing.

### Ticket Status and Failed Counter

- Leave **Ticket Status** empty unless the source states a ticket-level status.
  Empty means the tracker computes it from the test case statuses, which is
  usually what you want.
- **Failed Counter** may differ per row in the source. Copy it as-is; the
  importer takes the highest value in the ticket.

## Output

Return only the table — no commentary, no explanation, no markdown fences around
it. Preserve the original wording of Description, Expected Result, Actual Result,
and Comments; do not summarize or rewrite them. If you had to invent or change a
value in a required column, list those changes in a short note *after* the table.

---

## After conversion

1. Paste the result into the `Import` sheet of
   `qa-tracker-import-template.xlsx`, starting at row 2.
2. Upload it on the Import page and read the preview before applying — it shows
   every ticket as new, updated, or unchanged, and names the cell behind any
   error.
3. The `Allowed Values` sheet in the template lists the same rules, so the file
   stays self-documenting once it leaves this repo.

## What the importer will not do for you

- Two different Issue Types on rows of the same ticket → that ticket is skipped.
- `N/A` in Priority → skipped. There is no default; an unreadable priority is
  never silently downgraded to LOW.
- A blank Expected Result → skipped.
- A malformed date → skipped, with a suggested correction in the message.

Anything skipped is listed with its cell address, and every other ticket in the
file still imports. Fixing a rejection and re-uploading is safe: unchanged
tickets are left alone.
