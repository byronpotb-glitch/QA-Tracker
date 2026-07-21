import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ArrowLeftIcon, PlusIcon } from "lucide-react";
import { db } from "@/db";
import { tickets } from "@/db/schema";
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
import { TicketControls } from "./ticket-controls";
import { TestCaseDialog } from "./test-case-dialog";
import { TestCaseRow } from "./test-case-row";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const ticket = await db.query.tickets.findFirst({
    where: eq(tickets.id, id),
    with: { testCases: true },
  });

  if (!ticket) {
    notFound();
  }

  const testCases = [...ticket.testCases].sort((a, b) =>
    a.tcNumber.localeCompare(b.tcNumber, undefined, { numeric: true })
  );

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/tickets"
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-3.5" />
        Back to tickets
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{ticket.title}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <TicketControls
            ticketId={ticket.id}
            status={ticket.ticketStatus}
            manualOverride={ticket.manualOverride}
          />

          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">Company</dt>
              <dd>{ticket.company}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">System</dt>
              <dd>{ticket.system}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Module</dt>
              <dd>{ticket.module}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Issue Type</dt>
              <dd>{ticket.issueType.replace(/_/g, " ")}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Tester</dt>
              <dd>{ticket.tester}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Failed Count</dt>
              <dd>{ticket.failedCounter}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Created</dt>
              <dd>{dateFormatter.format(ticket.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Updated</dt>
              <dd>{dateFormatter.format(ticket.updatedAt)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">
            Test Cases ({testCases.length})
          </h2>
          <TestCaseDialog
            ticketId={ticket.id}
            trigger={
              <Button size="sm">
                <PlusIcon />
                Add test case
              </Button>
            }
          />
        </div>

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
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {testCases.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No test cases yet.
                  </TableCell>
                </TableRow>
              )}
              {testCases.map((tc) => (
                <TestCaseRow key={tc.id} ticketId={ticket.id} testCase={tc} />
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
