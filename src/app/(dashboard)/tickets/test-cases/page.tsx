import Link from "next/link";
import { and, desc, eq, ilike, isNotNull } from "drizzle-orm";
import { ArrowLeftIcon } from "lucide-react";
import { db } from "@/db";
import { tickets } from "@/db/schema";
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
import { TicketFilters } from "../ticket-filters";
import type { Company, IssueType, TestCaseStatus, TicketStatus } from "@/lib/validations";

export const dynamic = "force-dynamic";

const COMPANIES: readonly Company[] = ["POTB", "GLADEX"];
const STATUSES: readonly TicketStatus[] = [
  "PASSED",
  "FAILED",
  "IN_PROGRESS",
  "PENDING",
  "ON_HOLD",
];
const ISSUE_TYPES: readonly IssueType[] = [
  "BUG",
  "FEATURE",
  "IMPROVEMENT",
  "CHANGE_REQUEST",
];
const TEST_CASE_STATUSES: readonly TestCaseStatus[] = [
  "PASSED",
  "FAILED",
  "IN_PROGRESS",
  "PENDING",
  "ON_HOLD",
  "NOT_TESTED",
];

export default async function AllTestCasesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    company?: string;
    status?: string;
    system?: string;
    issue_type?: string;
    dev?: string;
    tc_status?: string;
  }>;
}) {
  const params = await searchParams;

  const [systemRows, devRows] = await Promise.all([
    db.selectDistinct({ system: tickets.system }).from(tickets),
    db
      .selectDistinct({ dev: tickets.dev })
      .from(tickets)
      .where(isNotNull(tickets.dev)),
  ]);
  const systems = systemRows.map((r) => r.system).sort();
  const devs = devRows
    .map((r) => r.dev)
    .filter((d): d is string => d !== null)
    .sort();

  const filters = [];
  if (params.q && params.q.trim()) {
    filters.push(ilike(tickets.title, `%${params.q.trim()}%`));
  }
  if (params.company && COMPANIES.includes(params.company as Company)) {
    filters.push(eq(tickets.company, params.company as Company));
  }
  if (params.status && STATUSES.includes(params.status as TicketStatus)) {
    filters.push(eq(tickets.ticketStatus, params.status as TicketStatus));
  }
  if (params.system && systems.includes(params.system)) {
    filters.push(eq(tickets.system, params.system));
  }
  if (params.issue_type && ISSUE_TYPES.includes(params.issue_type as IssueType)) {
    filters.push(eq(tickets.issueType, params.issue_type as IssueType));
  }
  if (params.dev) {
    filters.push(eq(tickets.dev, params.dev));
  }

  const allTickets = await db.query.tickets.findMany({
    where: filters.length ? and(...filters) : undefined,
    with: { testCases: true },
    orderBy: desc(tickets.updatedAt),
  });

  const tcStatus =
    params.tc_status && TEST_CASE_STATUSES.includes(params.tc_status as TestCaseStatus)
      ? (params.tc_status as TestCaseStatus)
      : undefined;

  const ticketsWithTestCases = allTickets
    .map((t) => ({
      ...t,
      testCases: [...t.testCases]
        .filter((tc) => !tcStatus || tc.status === tcStatus)
        .sort((a, b) => a.tcNumber.localeCompare(b.tcNumber, undefined, { numeric: true })),
    }))
    .filter((t) => t.testCases.length > 0);

  const totalTestCases = ticketsWithTestCases.reduce(
    (sum, t) => sum + t.testCases.length,
    0
  );

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/tickets"
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-3.5" />
        Back to tickets
      </Link>

      <div>
        <h1 className="text-lg font-semibold">Test Cases</h1>
        <p className="text-sm text-muted-foreground">
          {totalTestCases} test case{totalTestCases === 1 ? "" : "s"} across{" "}
          {ticketsWithTestCases.length} ticket
          {ticketsWithTestCases.length === 1 ? "" : "s"}.
        </p>
      </div>

      <TicketFilters
        q={params.q}
        company={params.company}
        status={params.status}
        system={params.system}
        issueType={params.issue_type}
        dev={params.dev}
        systems={systems}
        devs={devs}
      />

      {tcStatus && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            Filtered by test case status:{" "}
            <span className="font-medium text-foreground">
              {tcStatus.replace(/_/g, " ")}
            </span>
          </span>
          <Link href="/tickets/test-cases" className="text-primary hover:underline">
            Clear
          </Link>
        </div>
      )}

      {ticketsWithTestCases.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No test cases yet.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {ticketsWithTestCases.map((ticket) => (
            <Card key={ticket.id}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-sm font-medium">
                    <Link
                      href={`/tickets/${ticket.id}`}
                      className="hover:underline"
                    >
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
              <CardContent>
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
                      {ticket.testCases.map((tc) => (
                        <TableRow key={tc.id}>
                          <TableCell className="font-medium">
                            {tc.tcNumber}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {tc.page}
                          </TableCell>
                          <TableCell
                            className="max-w-80 truncate"
                            title={tc.description}
                          >
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
