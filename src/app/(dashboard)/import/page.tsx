"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  FileSpreadsheetIcon,
  MinusIcon,
  PencilIcon,
  PlusIcon,
  WandSparklesIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  applyExcelImport,
  cleanupExcelImport,
  previewExcelImport,
  type ApplyResult,
  type CleanupReport,
  type PreviewReport,
  type PreviewTicket,
} from "./actions";

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function base64ToFile(base64: string, name: string): File {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], name, { type: XLSX_MIME });
}

function downloadFile(base64: string, name: string) {
  const url = URL.createObjectURL(base64ToFile(base64, name));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Header order the sheet is expected to use, shown as guidance on the page. */
const EXPECTED_COLUMNS = [
  "Test ID",
  "Title",
  "Test Case ID",
  "Company",
  "System",
  "Module",
  "Page",
  "Description",
  "Priority",
  "Issue Type",
  "Expected Result",
  "Actual Result",
  "Comments",
  "Status",
  "Ticket Status",
  "Failed Counter",
  "Date",
  "Lakbay Tester's",
  "DEVS",
];

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [cleanup, setCleanup] = useState<CleanupReport | null>(null);
  const [report, setReport] = useState<PreviewReport | null>(null);
  const [done, setDone] = useState<ApplyResult | null>(null);
  const [pending, startTransition] = useTransition();
  // Bumped after a successful import to remount the file input, which is the
  // only reliable way to clear its selected filename.
  const [inputKey, setInputKey] = useState(0);

  function handleFileChange(next: File | null) {
    setFile(next);
    setCleanup(null);
    setReport(null);
    setDone(null);
  }

  function handleCleanup() {
    if (!file) return;
    const formData = new FormData();
    formData.set("file", file);

    startTransition(async () => {
      const result = await cleanupExcelImport(formData);
      setCleanup(result);
      setReport(null);
      setDone(null);

      if (result.fileErrors.length > 0) {
        toast.error(result.fileErrors[0]);
        return;
      }

      if (result.file) {
        // The cleaned file becomes the active selection, so Preview/Apply
        // work on it directly — no manual re-upload needed.
        setFile(base64ToFile(result.file.base64, result.file.name));
        toast.success("Cleaned up — review below, then preview or apply.");
      } else {
        toast.error("Nothing left to clean up — every row was dropped.");
      }
    });
  }

  function handlePreview() {
    if (!file) return;
    const formData = new FormData();
    formData.set("file", file);

    startTransition(async () => {
      const result = await previewExcelImport(formData);
      setReport(result);
      if (result.fileErrors.length > 0) {
        toast.error(result.fileErrors[0]);
      }
    });
  }

  function handleApply() {
    if (!file) return;
    const formData = new FormData();
    formData.set("file", file);

    startTransition(async () => {
      const result = await applyExcelImport(formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Import applied");
      setDone(result);
      setCleanup(null);
      setReport(null);
      setFile(null);
      setInputKey((key) => key + 1);
    });
  }

  // Before a preview, a chosen file is enough — the server validates and
  // reports what it skipped either way. After a preview, don't offer to apply
  // a file that has nothing to write.
  const canApply = Boolean(
    file &&
      !pending &&
      (!report ||
        (report.fileErrors.length === 0 &&
          report.tickets.some((ticket) => ticket.kind !== "unchanged")))
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">Import from Excel</h1>
        <p className="text-sm text-muted-foreground">
          Upload the QA tracker sheet. Each row is a test case; rows sharing a
          Title belong to one ticket. Re-uploading an updated sheet applies what
          changed and skips what didn&apos;t.
        </p>
      </div>

      {done && <AppliedCard result={done} />}

      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              key={inputKey}
              type="file"
              accept=".xlsx"
              className="max-w-sm"
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
            />
            <Button
              variant="outline"
              onClick={handleCleanup}
              disabled={!file || pending}
            >
              {pending ? "Working..." : "Clean up file"}
            </Button>
            <Button
              variant="outline"
              onClick={handlePreview}
              disabled={!file || pending}
            >
              {pending ? "Working..." : "Preview changes"}
            </Button>
            <Button onClick={handleApply} disabled={!canApply}>
              {pending ? "Importing..." : "Apply import"}
            </Button>
          </div>

          {file && (
            <p className="text-sm text-muted-foreground">
              Selected: <span className="font-mono text-xs">{file.name}</span>
            </p>
          )}

          {file && !cleanup && !report && (
            <p className="text-sm text-muted-foreground">
              Clean up fixes typos, spelling, and duplicate IDs automatically —
              worth running before Preview if the sheet was typed by hand.
              Anything it can&apos;t safely fix is listed either way.
            </p>
          )}

          <details className="text-sm text-muted-foreground">
            <summary className="cursor-pointer select-none">
              Expected columns
            </summary>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {EXPECTED_COLUMNS.map((column) => (
                <Badge key={column} variant="outline" className="font-normal">
                  {column}
                </Badge>
              ))}
            </div>
            <p className="mt-2">
              Column order doesn&apos;t matter — headers are matched by name.
              Test ID is ignored.
            </p>
          </details>
        </CardContent>
      </Card>

      {cleanup && <CleanupReportCard report={cleanup} />}

      {report && report.fileErrors.length > 0 && (
        <Card className="border-destructive/40">
          <CardContent className="flex flex-col gap-2">
            {report.fileErrors.map((error) => (
              <p key={error} className="text-sm text-destructive">
                {error}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      {report && report.fileErrors.length === 0 && (
        <>
          <SummaryCard report={report} />

          {report.rejected.length > 0 && <RejectedCard report={report} />}

          <TicketPlansCard tickets={report.tickets} />

          <div className="flex items-center justify-end gap-3">
            {report.rejected.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {report.rejected.length} ticket
                {report.rejected.length === 1 ? "" : "s"} will be skipped.
              </p>
            )}
            <Button onClick={handleApply} disabled={!canApply}>
              {pending ? "Importing..." : "Apply import"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function CleanupReportCard({ report }: { report: CleanupReport }) {
  if (report.fileErrors.length > 0) {
    return (
      <Card className="border-destructive/40">
        <CardContent className="flex flex-col gap-2">
          {report.fileErrors.map((error) => (
            <p key={error} className="text-sm text-destructive">
              {error}
            </p>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-blue-600/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <WandSparklesIcon className="size-4 text-blue-600 dark:text-blue-400" />
          Cleanup report
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm">
            Fixed{" "}
            <span className="font-mono tabular-nums">{report.fixes.length}</span>{" "}
            cell{report.fixes.length === 1 ? "" : "s"}
            {report.removedRowNumbers.length > 0 && (
              <>
                , removed{" "}
                <span className="font-mono tabular-nums">
                  {report.removedRowNumbers.length}
                </span>{" "}
                non-test-case row{report.removedRowNumbers.length === 1 ? "" : "s"}
              </>
            )}
            .
          </p>
          {report.file && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadFile(report.file!.base64, report.file!.name)}
            >
              Download cleaned file
            </Button>
          )}
        </div>

        {report.fixes.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer select-none text-muted-foreground">
              What was fixed
            </summary>
            <ul className="mt-2 flex flex-col gap-0.5">
              {report.fixes.map((fix, index) => (
                <li key={`${fix.location}-${index}`} className="text-xs">
                  <span className="font-mono">{fix.location}</span> ·{" "}
                  {fix.column}:{" "}
                  <span className="line-through opacity-60">{fix.from}</span> →{" "}
                  <span className="font-medium">{fix.to}</span>
                </li>
              ))}
            </ul>
          </details>
        )}

        {report.remainingIssues.length > 0 ? (
          <div className="rounded-lg border border-amber-500/40 p-3">
            <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
              {report.remainingIssues.length} thing
              {report.remainingIssues.length === 1 ? "" : "s"} still need a
              manual fix in the sheet
            </p>
            <ul className="mt-1 flex flex-col gap-0.5">
              {report.remainingIssues.map((issue, index) => (
                <li
                  key={`${issue.location}-${index}`}
                  className="text-xs text-muted-foreground"
                >
                  <span className="font-mono">{issue.location}</span>
                  {issue.column ? ` · ${issue.column}` : ""} — {issue.message}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          report.file && (
            <p className="text-sm text-green-600 dark:text-green-400">
              Nothing left that needs a manual fix.
            </p>
          )
        )}

        {report.file && (
          <p className="text-xs text-muted-foreground">
            The cleaned file is now selected above — Preview or Apply when
            ready.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function AppliedCard({ result }: { result: ApplyResult }) {
  const summary = result.summary;
  const rejected = result.rejected ?? [];
  const skipped = result.skippedRowNumbers ?? [];

  return (
    <Card className="border-green-600/30">
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2Icon className="size-4 shrink-0 text-green-600 dark:text-green-400" />
            <span className="text-sm">
              {summary ? (
                <>
                  Imported{" "}
                  <span className="font-mono tabular-nums">
                    {summary.newTickets}
                  </span>{" "}
                  new and updated{" "}
                  <span className="font-mono tabular-nums">
                    {summary.updatedTickets}
                  </span>{" "}
                  existing ticket
                  {summary.updatedTickets === 1 ? "" : "s"}.
                </>
              ) : (
                "Import applied."
              )}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href="/tickets" />}
          >
            View tickets
          </Button>
        </div>

        {skipped.length > 0 && (
          <p className="text-sm text-muted-foreground">
            Skipped {skipped.length} row{skipped.length === 1 ? "" : "s"} with no
            Test Case ID, Description, or Status:{" "}
            <span className="font-mono text-xs">{formatRowList(skipped)}</span>
          </p>
        )}

        {rejected.length > 0 && (
          <div className="rounded-lg border border-destructive/40 p-3">
            <p className="flex items-center gap-2 text-sm font-medium text-destructive">
              <AlertTriangleIcon className="size-4" />
              {rejected.length} ticket{rejected.length === 1 ? "" : "s"} not
              imported
            </p>
            <div className="mt-2 flex flex-col gap-2">
              {rejected.map((rejection) => (
                <div key={`${rejection.title}-${rejection.rows}`}>
                  <p className="text-sm">
                    {rejection.title}{" "}
                    <span className="text-muted-foreground">
                      ({rejection.rows})
                    </span>
                  </p>
                  <ul className="flex flex-col gap-0.5">
                    {rejection.issues.map((issue, index) => (
                      <li
                        key={`${issue.location}-${index}`}
                        className="text-xs text-destructive"
                      >
                        <span className="font-mono">{issue.location}</span>
                        {issue.column ? ` · ${issue.column}` : ""} —{" "}
                        {issue.message}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Fix these in the sheet and upload it again — the tickets that did
              import will show as unchanged.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Collapses consecutive row numbers: [247,248,249,255] -> "247–249, 255". */
function formatRowList(rows: number[]): string {
  const sorted = [...rows].sort((a, b) => a - b);
  const parts: string[] = [];
  let start = sorted[0];
  let previous = sorted[0];

  for (const row of sorted.slice(1)) {
    if (row === previous + 1) {
      previous = row;
      continue;
    }
    parts.push(start === previous ? `${start}` : `${start}–${previous}`);
    start = row;
    previous = row;
  }
  parts.push(start === previous ? `${start}` : `${start}–${previous}`);

  return parts.join(", ");
}

function SummaryCard({ report }: { report: PreviewReport }) {
  const { summary } = report;

  const stats = [
    { label: "New tickets", value: summary.newTickets },
    { label: "Tickets to update", value: summary.updatedTickets },
    { label: "Unchanged", value: summary.unchangedTickets },
    { label: "New test cases", value: summary.newTestCases },
    { label: "Test cases to update", value: summary.updatedTestCases },
    { label: "History snapshots", value: summary.historySnapshots },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Preview</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {stats.map((stat) => (
            <div key={stat.label}>
              <dd className="font-mono text-2xl font-semibold tabular-nums">
                {stat.value}
              </dd>
              <dt className="text-xs text-muted-foreground">{stat.label}</dt>
            </div>
          ))}
        </dl>

        {summary.missingTestCases > 0 && (
          <p className="text-sm text-muted-foreground">
            {summary.missingTestCases} existing test case
            {summary.missingTestCases === 1 ? "" : "s"} not present in the sheet.
            Nothing is deleted — they stay as they are.
          </p>
        )}

        {report.skippedRowNumbers.length > 0 && (
          <p className="text-sm text-muted-foreground">
            Skipped {report.skippedRowNumbers.length} row
            {report.skippedRowNumbers.length === 1 ? "" : "s"} with no Test Case
            ID, Description, or Status:{" "}
            <span className="font-mono text-xs">
              {formatRowList(report.skippedRowNumbers)}
            </span>
          </p>
        )}

        {report.sheetName && (
          <p className="text-xs text-muted-foreground">
            Read from sheet &ldquo;{report.sheetName}&rdquo;.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function RejectedCard({ report }: { report: PreviewReport }) {
  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangleIcon className="size-4 text-destructive" />
          Skipped tickets ({report.rejected.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {report.rejected.map((rejection) => (
          <div key={`${rejection.title}-${rejection.rows}`}>
            <p className="text-sm font-medium">
              {rejection.title}{" "}
              <span className="font-normal text-muted-foreground">
                ({rejection.rows})
              </span>
            </p>
            <ul className="mt-1 flex flex-col gap-0.5">
              {rejection.issues.map((issue, index) => (
                <li
                  key={`${issue.location}-${index}`}
                  className="text-sm text-destructive"
                >
                  <span className="font-mono">{issue.location}</span>
                  {issue.column ? ` · ${issue.column}` : ""} — {issue.message}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

const KIND_META = {
  new: {
    label: "New",
    icon: PlusIcon,
    className: "border-transparent bg-green-500/10 text-green-600 dark:text-green-400",
  },
  update: {
    label: "Update",
    icon: PencilIcon,
    className: "border-transparent bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  unchanged: {
    label: "Unchanged",
    icon: MinusIcon,
    className: "border-border text-muted-foreground",
  },
} as const;

function TicketPlansCard({ tickets }: { tickets: PreviewTicket[] }) {
  const changing = tickets.filter((ticket) => ticket.kind !== "unchanged");
  const unchanged = tickets.filter((ticket) => ticket.kind === "unchanged");

  if (tickets.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          No readable tickets in this sheet.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileSpreadsheetIcon className="size-4 text-muted-foreground" />
          Tickets ({tickets.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {changing.map((ticket) => (
          <TicketPlanRow key={`${ticket.title}-${ticket.rows}`} ticket={ticket} />
        ))}

        {unchanged.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer select-none text-muted-foreground">
              {unchanged.length} unchanged ticket
              {unchanged.length === 1 ? "" : "s"} — will be skipped
            </summary>
            <ul className="mt-2 flex flex-col gap-1">
              {unchanged.map((ticket) => (
                <li key={ticket.title} className="text-muted-foreground">
                  {ticket.title}
                </li>
              ))}
            </ul>
          </details>
        )}
      </CardContent>
    </Card>
  );
}

function TicketPlanRow({ ticket }: { ticket: PreviewTicket }) {
  const meta = KIND_META[ticket.kind];
  const Icon = meta.icon;

  return (
    <div className="rounded-lg ring-1 ring-foreground/10">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <Badge variant="outline" className={meta.className}>
          <Icon className="size-3" />
          {meta.label}
        </Badge>
        <span className="text-sm font-medium">{ticket.title}</span>
        <span className="text-xs text-muted-foreground">
          {ticket.company}
          {ticket.rows ? ` · ${ticket.rows}` : ""}
        </span>
        <span className="ml-auto text-xs text-muted-foreground">
          {ticket.kind === "new"
            ? `${ticket.testCaseCount} test case${ticket.testCaseCount === 1 ? "" : "s"}`
            : [
                ticket.newTestCases > 0 ? `+${ticket.newTestCases} new` : null,
                ticket.updatedTestCases > 0
                  ? `${ticket.updatedTestCases} updated`
                  : null,
                ticket.historySnapshots > 0
                  ? `${ticket.historySnapshots} snapshot${ticket.historySnapshots === 1 ? "" : "s"}`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
        </span>
      </div>

      {(ticket.changes.length > 0 ||
        ticket.warnings.length > 0 ||
        ticket.missingTcNumbers.length > 0) && (
        <div className="flex flex-col gap-2 border-t border-foreground/10 px-3 py-2">
          {ticket.changes.length > 0 && (
            <ul className="flex flex-col gap-0.5">
              {ticket.changes.map((change, index) => (
                <li key={`${change.label}-${index}`} className="text-xs">
                  <span className="text-muted-foreground">{change.label}:</span>{" "}
                  <span className="line-through opacity-60">{change.from}</span>{" "}
                  → <span className="font-medium">{change.to}</span>
                </li>
              ))}
            </ul>
          )}

          {ticket.warnings.length > 0 && (
            <div>
              <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                Not applied — the tracker&apos;s wording is kept:
              </p>
              <ul className="mt-0.5 flex flex-col gap-0.5">
                {ticket.warnings.map((warning, index) => (
                  <li
                    key={`${warning.label}-${index}`}
                    className="text-xs text-muted-foreground"
                  >
                    {warning.label}: &ldquo;{warning.from}&rdquo; in tracker,
                    &ldquo;{warning.to}&rdquo; in sheet
                  </li>
                ))}
              </ul>
            </div>
          )}

          {ticket.missingTcNumbers.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Not in the sheet, left untouched:{" "}
              {ticket.missingTcNumbers.join(", ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
