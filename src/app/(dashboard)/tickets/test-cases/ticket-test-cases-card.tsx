"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PriorityBadge, StatusBadge } from "@/lib/status";
import type { Ticket, TestCase } from "@/db/schema";

const PREVIEW_LIMIT = 5;

export function TicketTestCasesCard({
  ticket,
}: {
  ticket: Ticket & { testCases: TestCase[] };
}) {
  const [expanded, setExpanded] = useState(false);
  const hasMore = ticket.testCases.length > PREVIEW_LIMIT;
  const visible = expanded ? ticket.testCases : ticket.testCases.slice(0, PREVIEW_LIMIT);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm font-medium">
            <Link href={`/tickets/${ticket.id}`} className="hover:underline">
              {ticket.title}
            </Link>
          </CardTitle>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{ticket.company}</span>
            <StatusBadge status={ticket.ticketStatus} />
            <span>
              {ticket.testCases.length} test case
              {ticket.testCases.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="rounded-xl ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>TC#</TableHead>
                <TableHead>Page</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tested</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((tc) => (
                <TableRow key={tc.id}>
                  <TableCell className="font-medium">{tc.tcNumber}</TableCell>
                  <TableCell className="text-muted-foreground">{tc.page}</TableCell>
                  <TableCell className="max-w-80 truncate" title={tc.description}>
                    {tc.description}
                  </TableCell>
                  <TableCell>
                    <PriorityBadge priority={tc.priority} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={tc.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {tc.testedDate ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {hasMore && (
          <Button
            variant="outline"
            size="sm"
            className="self-center"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "Show less" : `Show all ${ticket.testCases.length}`}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
