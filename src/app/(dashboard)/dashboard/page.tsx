import Link from "next/link";
import { desc, gt, sql } from "drizzle-orm";
import {
  TicketIcon,
  ClipboardListIcon,
  XCircleIcon,
  RefreshCcwIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  ArrowRightIcon,
} from "lucide-react";
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
import {
  computeDevPerformance,
  sortByHighPerformance,
  sortByLowPerformance,
} from "@/lib/dev-performance";
import { DevMiniList } from "../dev-mini-list";
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
  const [ticketRows, testCaseRows, recurringFailures, devRows] = await Promise.all([
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
    db
      .select({
        dev: tickets.dev,
        ticketStatus: tickets.ticketStatus,
        failedCounter: tickets.failedCounter,
      })
      .from(tickets),
  ]);

  const devPerformance = computeDevPerformance(devRows);
  const topPerformers = sortByHighPerformance(
    devPerformance.filter((d) => d.passed > 0)
  ).slice(0, 3);
  const needsAttention = sortByLowPerformance(devPerformance).slice(0, 3);

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
  const failedCount = ticketCountMap.get("FAILED") ?? 0;
  const pct = (n: number) => (totalTickets > 0 ? Math.round((n / totalTickets) * 100) : 0);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold">Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile
          label="Total tickets"
          value={totalTickets}
          icon={TicketIcon}
          href="/tickets"
        />
        <StatTile
          label="Total test cases"
          value={totalTestCases}
          icon={ClipboardListIcon}
          href="/tickets"
        />
        <StatTile
          label="Failed tickets"
          value={failedCount}
          icon={XCircleIcon}
          tone="critical"
          percent={pct(failedCount)}
          href="/tickets?status=FAILED"
        />
        <StatTile
          label="Recurring failures"
          value={recurringFailures.length}
          icon={RefreshCcwIcon}
          tone="warning"
          percent={pct(recurringFailures.length)}
          href="/tickets?recurring=1"
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
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">Dev Performance</h2>
            <p className="text-sm text-muted-foreground">
              Tickets grouped by assigned dev.
            </p>
          </div>
          <Link
            href="/dev-performance"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            View full report
            <ArrowRightIcon className="size-3.5" />
          </Link>
        </div>

        {devPerformance.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              No tickets have a dev assigned yet.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <DevMiniList
              title="Top performers"
              icon={TrendingUpIcon}
              iconClassName="text-green-600 dark:text-green-400"
              devs={topPerformers}
              metric="passed"
            />
            <DevMiniList
              title="Needs attention"
              icon={TrendingDownIcon}
              iconClassName="text-destructive"
              devs={needsAttention}
              metric="failed"
            />
          </div>
        )}
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
  icon: Icon,
  percent,
  tone = "default",
  href,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  percent?: number;
  tone?: "default" | "critical" | "warning";
  href: string;
}) {
  const toneClasses = {
    default: {
      iconBg: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
      bar: "bg-blue-600",
    },
    critical: {
      iconBg: "bg-destructive/10 text-destructive",
      bar: "bg-destructive",
    },
    warning: {
      iconBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      bar: "bg-amber-500",
    },
  }[tone];

  return (
    <Link href={href} className="block">
      <Card className="transition-shadow hover:shadow-md hover:ring-foreground/20">
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{label}</span>
            <div
              className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${toneClasses.iconBg}`}
            >
              <Icon className="size-4" />
            </div>
          </div>
          <span className="text-2xl font-semibold">{value.toLocaleString()}</span>
          {percent !== undefined && (
            <div className="flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full ${toneClasses.bar}`}
                  style={{ width: `${Math.min(100, percent)}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground">{percent}%</span>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
