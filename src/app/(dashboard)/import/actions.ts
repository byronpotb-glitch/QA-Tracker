"use server";

import { revalidatePath } from "next/cache";
import { eq, max } from "drizzle-orm";
import { db } from "@/db";
import { requireAdmin } from "@/lib/auth/roles";
import { tickets, testCases, testCaseHistory } from "@/db/schema";
import { recomputeRollup } from "@/lib/recompute-rollup";
import {
  issueLocation,
  parseWorkbook,
  type ParsedTicket,
  type ParseResult,
} from "@/lib/import/parse-excel";
import {
  reconcile,
  type ExistingTicket,
  type ReconcileResult,
  type TicketPlan,
} from "@/lib/import/reconcile";
import { buildCleanedWorkbook, cleanupWorkbook } from "@/lib/import/cleanup";

/** Bigger than any real QA sheet; a guard against pathological uploads. */
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export interface PreviewChange {
  label: string;
  from: string;
  to: string;
}

export interface PreviewTicket {
  kind: "new" | "update" | "unchanged";
  title: string;
  company: string;
  /** Sheet rows this ticket came from, e.g. "2–6". */
  rows: string;
  testCaseCount: number;
  newTestCases: number;
  updatedTestCases: number;
  historySnapshots: number;
  changes: PreviewChange[];
  warnings: PreviewChange[];
  missingTcNumbers: string[];
}

export interface PreviewIssue {
  /** Cell address, or "row N" when the problem isn't cell-specific. */
  location: string;
  column: string | null;
  message: string;
}

export interface PreviewRejection {
  title: string;
  rows: string;
  issues: PreviewIssue[];
}

export interface PreviewReport {
  fileErrors: string[];
  tickets: PreviewTicket[];
  rejected: PreviewRejection[];
  summary: ReconcileResult["summary"];
  /** Sheet the data came from, so a multi-sheet workbook isn't a mystery. */
  sheetName: string | null;
  /** Rows that held something but weren't test cases. */
  skippedRowNumbers: number[];
}

export interface ApplyResult {
  error: string | null;
  summary?: ReconcileResult["summary"];
  /**
   * Tickets left out of the import. Returned even when the user applied without
   * previewing, so a partial import never hides what it skipped.
   */
  rejected?: PreviewRejection[];
  skippedRowNumbers?: number[];
}

const EMPTY_SUMMARY: ReconcileResult["summary"] = {
  newTickets: 0,
  updatedTickets: 0,
  unchangedTickets: 0,
  newTestCases: 0,
  updatedTestCases: 0,
  historySnapshots: 0,
  warnings: 0,
  missingTestCases: 0,
};

function fileErrorReport(...messages: string[]): PreviewReport {
  return {
    fileErrors: messages,
    tickets: [],
    rejected: [],
    summary: EMPTY_SUMMARY,
    sheetName: null,
    skippedRowNumbers: [],
  };
}

/** Validates the upload itself, shared by every action that reads a file. */
function readUploadedFile(formData: FormData): { file: File } | { error: string } {
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose an .xlsx file to import." };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { error: "That file is larger than 10 MB." };
  }
  if (!/\.xlsx$/i.test(file.name)) {
    return {
      error: "Only .xlsx files are supported. Re-save the sheet as .xlsx.",
    };
  }

  return { file };
}

/**
 * Reads the upload and parses it. Shared by preview and apply so the apply
 * step works from the file itself rather than a plan the client sent back —
 * a tampered payload can't widen what gets written.
 */
async function parseUpload(
  formData: FormData
): Promise<{ parsed: ParseResult } | { error: string }> {
  const upload = readUploadedFile(formData);
  if ("error" in upload) return upload;

  const parsed = await parseWorkbook(await upload.file.arrayBuffer());
  return { parsed };
}

/** Loads every ticket with the fields reconciliation compares. */
async function loadExisting(): Promise<ExistingTicket[]> {
  const [rows, historyRounds] = await Promise.all([
    db.query.tickets.findMany({ with: { testCases: true } }),
    db
      .select({
        testCaseId: testCaseHistory.testCaseId,
        maxRound: max(testCaseHistory.round),
      })
      .from(testCaseHistory)
      .groupBy(testCaseHistory.testCaseId),
  ]);

  const maxRoundByTestCase = new Map(
    historyRounds.map((r) => [r.testCaseId, r.maxRound ?? 0])
  );

  return rows.map((ticket) => ({
    id: ticket.id,
    title: ticket.title,
    company: ticket.company,
    system: ticket.system,
    module: ticket.module,
    issueType: ticket.issueType,
    ticketStatus: ticket.ticketStatus,
    failedCounter: ticket.failedCounter,
    manualOverride: ticket.manualOverride,
    tester: ticket.tester,
    dev: ticket.dev,
    testCases: ticket.testCases.map((tc) => ({
      id: tc.id,
      tcNumber: tc.tcNumber,
      page: tc.page,
      description: tc.description,
      priority: tc.priority,
      expectedResult: tc.expectedResult,
      actualResult: tc.actualResult,
      comments: tc.comments,
      status: tc.status,
      testedDate: tc.testedDate,
      maxHistoryRound: maxRoundByTestCase.get(tc.id) ?? 0,
      tester: tc.tester,
    })),
  }));
}

function rowRange(first: number, last: number): string {
  return first === last ? `row ${first}` : `rows ${first}–${last}`;
}

function toPreviewTicket(plan: TicketPlan): PreviewTicket {
  if (plan.kind === "new") {
    return {
      kind: "new",
      title: plan.ticket.title,
      company: plan.ticket.company,
      rows: rowRange(plan.ticket.firstRow, plan.ticket.lastRow),
      testCaseCount: plan.ticket.testCases.length,
      newTestCases: plan.ticket.testCases.length,
      updatedTestCases: 0,
      historySnapshots: 0,
      changes: [],
      warnings: [],
      missingTcNumbers: [],
    };
  }

  if (plan.kind === "unchanged") {
    return {
      kind: "unchanged",
      title: plan.title,
      company: "",
      rows: "",
      testCaseCount: plan.testCaseCount,
      newTestCases: 0,
      updatedTestCases: 0,
      historySnapshots: 0,
      changes: [],
      warnings: [],
      missingTcNumbers: [],
    };
  }

  const inserts = plan.testCases.filter((tc) => tc.kind === "insert");
  const updates = plan.testCases.filter((tc) => tc.kind === "update");
  const hasWrites = plan.changes.length > 0 || plan.testCases.length > 0;

  return {
    // A plan with warnings but nothing to write is not an update.
    kind: hasWrites ? "update" : "unchanged",
    title: plan.ticket.title,
    company: plan.ticket.company,
    rows: rowRange(plan.ticket.firstRow, plan.ticket.lastRow),
    testCaseCount: plan.ticket.testCases.length,
    newTestCases: inserts.length,
    updatedTestCases: updates.length,
    historySnapshots: updates.filter(
      (tc) => tc.kind === "update" && tc.history !== null
    ).length,
    changes: [
      ...plan.changes.map((change) => ({
        label: change.label,
        from: change.from,
        to: change.to,
      })),
      ...plan.testCases.flatMap((tc) =>
        tc.kind === "update"
          ? tc.changes.map((change) => ({
              label: `${tc.tcNumber} · ${change.label}`,
              from: change.from,
              to: change.to,
            }))
          : []
      ),
    ],
    warnings: plan.warnings.map((warning) => ({
      label: warning.label,
      from: warning.from,
      to: warning.to,
    })),
    missingTcNumbers: plan.missingTcNumbers,
  };
}

function toRejections(parsed: ParseResult): PreviewRejection[] {
  return parsed.rejected.map((rejection) => ({
    title: rejection.title,
    rows: rowRange(rejection.firstRow, rejection.lastRow),
    issues: rejection.issues.map((issue) => ({
      location: issueLocation(issue),
      column: issue.column ?? null,
      message: issue.message,
    })),
  }));
}

function toReport(parsed: ParseResult, result: ReconcileResult): PreviewReport {
  return {
    fileErrors: parsed.fileErrors,
    tickets: result.plans.map(toPreviewTicket),
    rejected: toRejections(parsed),
    summary: result.summary,
    sheetName: parsed.sheetName,
    skippedRowNumbers: parsed.skippedRowNumbers,
  };
}

export async function previewExcelImport(
  formData: FormData
): Promise<PreviewReport> {
  const roleCheck = await requireAdmin();
  if (roleCheck.error) return fileErrorReport(roleCheck.error);

  const upload = await parseUpload(formData);
  if ("error" in upload) return fileErrorReport(upload.error);

  const { parsed } = upload;
  if (parsed.fileErrors.length > 0) return fileErrorReport(...parsed.fileErrors);

  const existing = await loadExisting();
  return toReport(parsed, reconcile(parsed.tickets, existing));
}

export async function applyExcelImport(
  formData: FormData
): Promise<ApplyResult> {
  const roleCheck = await requireAdmin();
  if (roleCheck.error) return roleCheck;

  const upload = await parseUpload(formData);
  if ("error" in upload) return { error: upload.error };

  const { parsed } = upload;
  if (parsed.fileErrors.length > 0) {
    return { error: parsed.fileErrors[0] };
  }
  if (parsed.tickets.length === 0) {
    return { error: "No valid tickets to import. Fix the errors and try again." };
  }

  // Reconciled against the database as it is right now, not as it was when the
  // preview was generated.
  const existing = await loadExisting();
  const { plans, summary } = reconcile(parsed.tickets, existing);

  /** Tickets whose status the rollup should recompute after the writes land. */
  const rollupTargets: string[] = [];

  try {
    await db.transaction(async (tx) => {
      for (const plan of plans) {
        if (plan.kind === "unchanged") continue;

        if (plan.kind === "new") {
          const [inserted] = await tx
            .insert(tickets)
            .values({
              title: plan.ticket.title,
              company: plan.ticket.company,
              system: plan.ticket.system,
              module: plan.ticket.module,
              issueType: plan.ticket.issueType,
              ticketStatus: plan.resolvedStatus,
              failedCounter: plan.ticket.failedCounter,
              manualOverride: plan.manualOverride,
              tester: plan.ticket.tester,
              dev: plan.ticket.dev,
            })
            .returning({ id: tickets.id });

          await tx
            .insert(testCases)
            .values(
              plan.ticket.testCases.map((tc) =>
                newTestCaseValues(inserted.id, tc, plan.ticket.tester)
              )
            );

          if (!plan.manualOverride) rollupTargets.push(inserted.id);
          continue;
        }

        const hasWrites = plan.changes.length > 0 || plan.testCases.length > 0;
        if (!hasWrites) continue;

        // Written whenever the ticket has any writes at all, not only when a
        // ticket-level field differs: the SET is idempotent for unchanged
        // fields, and skipping it would drop manualOverride when the sheet
        // asserts a status that already matches what's stored.
        await tx
          .update(tickets)
          .set({
            system: plan.ticket.system,
            module: plan.ticket.module,
            issueType: plan.ticket.issueType,
            tester: plan.ticket.tester,
            dev: plan.ticket.dev,
            // Only touch status/counter when the sheet asserted one.
            ...(plan.manualOverride && plan.ticket.ticketStatus !== null
              ? {
                  ticketStatus: plan.ticket.ticketStatus,
                  failedCounter: plan.ticket.failedCounter,
                  manualOverride: true,
                }
              : {}),
            updatedAt: new Date(),
          })
          .where(eq(tickets.id, plan.ticketId));

        for (const tc of plan.testCases) {
          if (tc.kind === "insert") {
            await tx
              .insert(testCases)
              .values(
                newTestCaseValues(plan.ticketId, tc.data, plan.ticket.tester)
              );
            continue;
          }

          // Snapshot the pre-import result before overwriting it, so a status
          // change doesn't erase what the previous round found.
          if (tc.history) {
            await tx.insert(testCaseHistory).values({
              testCaseId: tc.testCaseId,
              ticketId: plan.ticketId,
              round: tc.history.round,
              status: tc.history.status,
              actualResult: tc.history.actualResult,
              comments: tc.history.comments,
              testedDate: tc.history.testedDate,
              tester: tc.history.tester,
            });
          }

          await tx
            .update(testCases)
            .set({
              status: tc.values.status,
              actualResult: tc.values.actualResult,
              comments: tc.values.comments,
              testedDate: tc.values.testedDate,
              updatedAt: new Date(),
            })
            .where(eq(testCases.id, tc.testCaseId));
        }

        if (!plan.manualOverride) rollupTargets.push(plan.ticketId);
      }
    });
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? `Import failed, nothing was saved: ${err.message}`
          : "Import failed, nothing was saved.",
    };
  }

  // Outside the transaction: the writes are already durable, and a rollup
  // that fails shouldn't undo a successful import.
  for (const ticketId of rollupTargets) {
    await recomputeRollup(ticketId);
  }

  revalidatePath("/tickets");
  revalidatePath("/tickets/test-cases");
  revalidatePath("/dashboard");
  revalidatePath("/");

  return {
    error: null,
    summary,
    rejected: toRejections(parsed),
    skippedRowNumbers: parsed.skippedRowNumbers,
  };
}

function newTestCaseValues(
  ticketId: string,
  tc: ParsedTicket["testCases"][number],
  tester: string
) {
  return {
    ticketId,
    tcNumber: tc.tcNumber,
    page: tc.page,
    description: tc.description,
    priority: tc.priority,
    expectedResult: tc.expectedResult,
    actualResult: tc.actualResult,
    comments: tc.comments,
    status: tc.status,
    testedDate: tc.testedDate,
    // The sheet's tester column is ticket-level: one person runs the pass, so
    // it applies to every test case in the ticket.
    tester,
  };
}

export interface CleanupFix {
  /** Cell address, or "row N" when the fix wasn't cell-specific. */
  location: string;
  column: string;
  from: string;
  to: string;
}

export interface CleanupReport {
  fileErrors: string[];
  sheetName: string | null;
  fixes: CleanupFix[];
  remainingIssues: PreviewIssue[];
  removedRowNumbers: number[];
  /** Present only when there was at least one row left to write. */
  file?: { base64: string; name: string };
}

/**
 * Runs the deterministic cleanup pass and hands back a corrected .xlsx as
 * base64, plus a report of what was fixed and what still needs a manual
 * look. Read-only — never touches the database, so it's safe to run on any
 * file without risk of a bad guess landing in the tracker.
 */
export async function cleanupExcelImport(formData: FormData): Promise<CleanupReport> {
  const roleCheck = await requireAdmin();
  if (roleCheck.error) {
    return {
      fileErrors: [roleCheck.error],
      sheetName: null,
      fixes: [],
      remainingIssues: [],
      removedRowNumbers: [],
    };
  }

  const upload = readUploadedFile(formData);
  if ("error" in upload) {
    return {
      fileErrors: [upload.error],
      sheetName: null,
      fixes: [],
      remainingIssues: [],
      removedRowNumbers: [],
    };
  }

  const result = await cleanupWorkbook(await upload.file.arrayBuffer());
  if (result.fileErrors.length > 0) {
    return {
      fileErrors: result.fileErrors,
      sheetName: null,
      fixes: [],
      remainingIssues: [],
      removedRowNumbers: [],
    };
  }

  const fixes: CleanupFix[] = result.fixes.map((fix) => ({
    location: fix.cell ?? `row ${fix.rowNumber}`,
    column: fix.column,
    from: fix.from,
    to: fix.to,
  }));
  const remainingIssues: PreviewIssue[] = result.remainingIssues.map((issue) => ({
    location: issueLocation(issue),
    column: issue.column ?? null,
    message: issue.message,
  }));

  let file: { base64: string; name: string } | undefined;
  if (result.rows.length > 0) {
    const buffer = await buildCleanedWorkbook(result.rows);
    const baseName = upload.file.name.replace(/\.xlsx$/i, "");
    file = { base64: buffer.toString("base64"), name: `${baseName}-cleaned.xlsx` };
  }

  return {
    fileErrors: [],
    sheetName: result.sheetName,
    fixes,
    remainingIssues,
    removedRowNumbers: result.removedRowNumbers,
    file,
  };
}
