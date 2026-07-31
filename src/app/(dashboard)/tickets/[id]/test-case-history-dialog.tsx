"use client";

import { useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon, HistoryIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/lib/status";
import type { TestCaseHistory } from "@/db/schema";

export interface HistoryEntry extends TestCaseHistory {
  tcNumber: string;
  page: string;
}

export function TestCaseHistoryDialog({ entries }: { entries: HistoryEntry[] }) {
  const [roundIndex, setRoundIndex] = useState(0);

  const rounds = Array.from(new Set(entries.map((e) => e.round))).sort(
    (a, b) => a - b
  );

  if (rounds.length === 0) return null;

  const currentRound = rounds[roundIndex];
  const rows = entries
    .filter((e) => e.round === currentRound)
    .sort((a, b) => a.tcNumber.localeCompare(b.tcNumber, undefined, { numeric: true }));

  return (
    <Dialog onOpenChange={(next) => next && setRoundIndex(rounds.length - 1)}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <HistoryIcon />
            View history
          </Button>
        }
      />
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-4 pr-6">
            <span>Retest history — Round {currentRound}</span>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => setRoundIndex((i) => Math.max(0, i - 1))}
                disabled={roundIndex === 0}
                aria-label="Previous round"
              >
                <ChevronLeftIcon />
              </Button>
              <span className="text-xs font-normal text-muted-foreground">
                {roundIndex + 1} / {rounds.length}
              </span>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => setRoundIndex((i) => Math.min(rounds.length - 1, i + 1))}
                disabled={roundIndex === rounds.length - 1}
                aria-label="Next round"
              >
                <ChevronRightIcon />
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>
        <div className="rounded-xl ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>TC#</TableHead>
                <TableHead>Page</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actual Result</TableHead>
                <TableHead>Tested</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.tcNumber}</TableCell>
                  <TableCell className="text-muted-foreground">{r.page}</TableCell>
                  <TableCell>
                    <StatusBadge status={r.status} />
                  </TableCell>
                  <TableCell
                    className="max-w-64 truncate"
                    title={r.actualResult ?? undefined}
                  >
                    {r.actualResult ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.testedDate ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
