"use client";

import { HistoryIcon } from "lucide-react";
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
import type { TicketAuditLog } from "@/db/schema";

const FIELD_LABELS: Record<string, string> = {
  dev: "Dev",
  ticket_status: "Status",
  manual_override: "Manual override",
  created_at: "Created date",
  retest: "Retest",
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatValue(field: string, value: string | null): string {
  if (value === null) return "—";
  if (field === "created_at") return dateFormatter.format(new Date(value));
  return value.replace(/_/g, " ");
}

export function TicketAuditLogDialog({ entries }: { entries: TicketAuditLog[] }) {
  if (entries.length === 0) return null;

  const rows = [...entries].sort(
    (a, b) => b.changedAt.getTime() - a.changedAt.getTime()
  );

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <HistoryIcon />
            Activity
          </Button>
        }
      />
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Ticket activity</DialogTitle>
        </DialogHeader>
        <div className="rounded-xl ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Field</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead>By</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-medium">
                    {FIELD_LABELS[entry.field] ?? entry.field}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatValue(entry.field, entry.oldValue)}
                  </TableCell>
                  <TableCell>{formatValue(entry.field, entry.newValue)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {entry.changedBy}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {dateFormatter.format(entry.changedAt)}
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
