import Link from "next/link";
import { desc, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import { tickets, testCases } from "@/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/lib/status";
import { LazyStatusBarChart as StatusBarChart } from "./lazy-status-bar-chart";
import type { TicketStatus, TestCaseStatus } from "@/lib/validations";

export const dynamic = "force-dynamic";

const TICKET_STATUSES: readonly TicketStatus[] = [
  "PASSED",
  "FAILED",
  "IN_PROGRESS",
  "PENDING",
  "ON_HOLD",
];

const TEST_CASE_STATUSES: readonly TestCaseStatus[] = [
  "PASSED",
  "FAILED",
  "IN_PROGRESS",
  "PENDING",
  "ON_HOLD",
  "NOT_TESTED",
];

export default async function DashboardPage() {
  const [ticketRows, testCaseRows, recurringFailures] = await Promise.all([
    db
      .select({ status: tickets.ticketStatus, count: sql<number>`count(*)::int` })
      .from(tickets)
      .groupBy(tickets.ticketStatus),
    db
      .select({ status: testCases.status, count: sql<number>`count(*)::int` })
      .from(testCases)
      .groupBy(testCases.status),
    db
      .select()
      .from(tickets)
      .where(gt(tickets.failedCounter, 0))
      .orderBy(desc(tickets.failedCounter)),
  ]);

  const ticketCountMap = new Map(ticketRows.map((r) => [r.status, r.count]));
  const testCaseCountMap = new Map(testCaseRows.map((r) => [r.status, r.count]));

  const ticketChartData = TICKET_STATUSES.map((status) => ({
    status,
    count: ticketCountMap.get(status) ?? 0,
  }));
  const testCaseChartData = TEST_CASE_STATUSES.map((status) => ({
    status,
    count: testCaseCountMap.get(status) ?? 0,
  }));

  const totalTickets = ticketChartData.reduce((sum, d) => sum + d.count, 0);
  const totalTestCases = testCaseChartData.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold">Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile label="Total tickets" value={totalTickets} />
        <StatTile label="Total test cases" value={totalTestCases} />
        <StatTile
          label="Failed tickets"
          value={ticketCountMap.get("FAILED") ?? 0}
          tone="critical"
        />
        <StatTile
          label="Recurring failures"
          value={recurringFailures.length}
          tone="warning"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Tickets by status</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusBarChart data={ticketChartData} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Test cases by status</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusBarChart data={testCaseChartData} />
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3">
        <div>
          <h2 className="text-base font-semibold">Recurring failures</h2>
          <p className="text-sm text-muted-foreground">
            Tickets that failed, went back to dev, and came back for another
            round of testing — sorted by how many times they&apos;ve failed.
          </p>
        </div>
        <div className="rounded-xl ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Current Status</TableHead>
                <TableHead className="text-right">Times Failed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recurringFailures.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No recurring failures — nothing has failed more than once.
                  </TableCell>
                </TableRow>
              )}
              {recurringFailures.map((ticket) => (
                <TableRow key={ticket.id}>
                  <TableCell className="max-w-72 truncate">
                    <Link
                      href={`/tickets/${ticket.id}`}
                      className="font-medium hover:underline"
                    >
                      {ticket.title}
                    </Link>
                  </TableCell>
                  <TableCell>{ticket.company}</TableCell>
                  <TableCell>
                    <StatusBadge status={ticket.ticketStatus} />
                  </TableCell>
                  <TableCell className="text-right font-semibold text-destructive">
                    {ticket.failedCounter}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "critical" | "warning";
}) {
  const toneClass =
    tone === "critical"
      ? "text-destructive"
      : tone === "warning"
        ? "text-amber-600 dark:text-amber-400"
        : "text-foreground";

  return (
    <Card>
      <CardContent className="flex flex-col gap-1">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className={`text-2xl font-semibold ${toneClass}`}>
          {value.toLocaleString()}
        </span>
      </CardContent>
    </Card>
  );
}
