"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { HistoryIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { PriorityBadge, StatusBadge } from "@/lib/status";
import { deleteTestCase, updateTestCaseStatus } from "../actions";
import { TestCaseDialog } from "./test-case-dialog";
import type { TestCase, TestCaseHistory } from "@/db/schema";
import type { TestCaseStatus } from "@/lib/validations";

const STATUSES: readonly TestCaseStatus[] = [
  "NOT_TESTED",
  "IN_PROGRESS",
  "PASSED",
  "FAILED",
  "ON_HOLD",
  "PENDING",
];

export function TestCaseRow({
  ticketId,
  testCase,
  history,
}: {
  ticketId: string;
  testCase: TestCase;
  history: TestCaseHistory[];
}) {
  const [pending, startTransition] = useTransition();

  function handleStatusChange(value: string | null) {
    if (!value) return;
    startTransition(async () => {
      const result = await updateTestCaseStatus(
        ticketId,
        testCase.id,
        value as TestCaseStatus
      );
      if (result.error) toast.error(result.error);
    });
  }

  function handleDelete() {
    if (!confirm(`Delete test case ${testCase.tcNumber}?`)) return;
    startTransition(async () => {
      const result = await deleteTestCase(ticketId, testCase.id);
      if (result.error) toast.error(result.error);
      else toast.success("Test case deleted");
    });
  }

  return (
    <TableRow>
      <TableCell className="font-medium">{testCase.tcNumber}</TableCell>
      <TableCell className="text-muted-foreground">{testCase.page}</TableCell>
      <TableCell className="max-w-80 truncate" title={testCase.description}>
        {testCase.description}
      </TableCell>
      <TableCell>
        <PriorityBadge priority={testCase.priority} />
      </TableCell>
      <TableCell>
        <Select
          value={testCase.status}
          onValueChange={handleStatusChange}
          disabled={pending}
        >
          <SelectTrigger size="sm" className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="text-muted-foreground">
        {testCase.testedDate ?? "—"}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          {history.length > 0 && (
            <Popover>
              <PopoverTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="View retest history"
                    className="relative"
                  >
                    <HistoryIcon />
                    <span className="absolute -top-1 -right-1 flex size-3.5 items-center justify-center rounded-full bg-muted text-[9px] font-medium text-muted-foreground ring-1 ring-background">
                      {history.length}
                    </span>
                  </Button>
                }
              />
              <PopoverContent className="w-80">
                <PopoverHeader>
                  <PopoverTitle>Retest history</PopoverTitle>
                </PopoverHeader>
                <div className="flex flex-col gap-2">
                  {history.map((h) => (
                    <div
                      key={h.id}
                      className="flex flex-col gap-1 rounded-lg border border-border p-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Round {h.round}</span>
                        <StatusBadge status={h.status} />
                      </div>
                      {h.actualResult && (
                        <p className="text-muted-foreground">{h.actualResult}</p>
                      )}
                      <p className="text-muted-foreground">
                        {h.testedDate ?? "No tested date"}
                      </p>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}
          <TestCaseDialog
            ticketId={ticketId}
            testCase={testCase}
            trigger={
              <Button variant="ghost" size="icon-sm" aria-label="Edit test case">
                <PencilIcon />
              </Button>
            }
          />
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Delete test case"
            onClick={handleDelete}
            disabled={pending}
          >
            <Trash2Icon />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
