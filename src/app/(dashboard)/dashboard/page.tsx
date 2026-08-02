import Link from "next/link";
import { and, desc, eq, gt, gte, lte, sql } from "drizzle-orm";
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
import { DashboardDateFilter, type DateField } from "./date-filter";
import { DashboardCompanyFilter } from "./company-filter";
import type { Company, TicketStatus, TestCaseStatus } from "@/lib/validations";

const COMPANIES: readonly Company[] = ["POTB", "GLADEX"];
const RECURRING_PREVIEW_LIMIT = 5;

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

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; field?: string; company?: string }>;
}) {
  const params = await searchParams;
  const dateField: DateField = params.field === "updated" ? "updated" : "created";
  const dateColumn = dateField === "updated" ? tickets.updatedAt : tickets.createdAt;

  const company: Company | undefined =
    params.company === "POTB" || params.company === "GLADEX" ? params.company : undefined;
  const companyQueryParam = company ? `company=${company}` : "";

  const dateRange =
    params.from && params.to
      ? {
          from: new Date(`${params.from}T00:00:00`),
          to: new Date(`${params.to}T23:59:59.999`),
        }
      : null;

  const baseConditions = [
    dateRange ? gte(dateColumn, dateRange.from) : undefined,
    dateRange ? lte(dateColumn, dateRange.to) : undefined,
    company ? eq(tickets.company, company) : undefined,
  ].filter((c) => c !== undefined);

  const ticketDateFilter = baseConditions.length ? and(...baseConditions) : undefined;
  const recurringFilter = and(gt(tickets.failedCounter, 0), ...baseConditions);

  const [ticketRows, testCaseRows, recurringFailures, devRows, companyRows] = await Promise.all([
    db
      .select({ status: tickets.ticketStatus, count: sql<number>`count(*)::int` })
      .from(tickets)
      .where(ticketDateFilter)
      .groupBy(tickets.ticketStatus),
    db
      .select({ status: testCases.status, count: sql<number>`count(*)::int` })
      .from(testCases)
      .innerJoin(tickets, eq(testCases.ticketId, tickets.id))
      .where(ticketDateFilter)
      .groupBy(testCases.status),
    db
      .select({
        id: tickets.id,
        title: tickets.title,
        company: tickets.company,
        ticketStatus: tickets.ticketStatus,
        failedCounter: tickets.failedCounter,
      })
      .from(tickets)
      .where(recurringFilter)
      .orderBy(desc(tickets.failedCounter)),
    db
      .select({
        dev: tickets.dev,
        ticketStatus: tickets.ticketStatus,
        failedCounter: tickets.failedCounter,
      })
      .from(tickets)
      .where(ticketDateFilter),
    db
      .select({ company: tickets.company, count: sql<number>`count(*)::int` })
      .from(tickets)
      .where(ticketDateFilter)
      .groupBy(tickets.company),
  ]);

  const companyCountMap = new Map(
    companyRows.map((r) => [r.company as Company, r.count])
  );

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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-lg font-semibold">Dashboard</h1>
        <div className="flex flex-wrap items-center gap-2">
          <DashboardCompanyFilter company={company} />
          <DashboardDateFilter from={params.from} to={params.to} field={dateField} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile
          label="Total tickets"
          value={totalTickets}
          icon={TicketIcon}
          href={company ? `/tickets?${companyQueryParam}` : "/tickets"}
        />
        <StatTile
          label="Total test cases"
          value={totalTestCases}
          icon={ClipboardListIcon}
          href={company ? `/tickets/test-cases?${companyQueryParam}` : "/tickets/test-cases"}
        />
        <StatTile
          label="Failed tickets"
          value={failedCount}
          icon={XCircleIcon}
          tone="critical"
          percent={pct(failedCount)}
          href={`/tickets?status=FAILED${company ? `&${companyQueryParam}` : ""}`}
        />
        <StatTile
          label="Recurring failures"
          value={recurringFailures.length}
          icon={RefreshCcwIcon}
          tone="warning"
          percent={pct(recurringFailures.length)}
          href={`/tickets?recurring=1${company ? `&${companyQueryParam}` : ""}`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Tickets by status</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusBarChart
              data={ticketChartData}
              linkBase={`/tickets?${company ? `${companyQueryParam}&` : ""}status=`}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Test cases by status</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusBarChart
              data={testCaseChartData}
              linkBase={`/tickets/test-cases?${company ? `${companyQueryParam}&` : ""}tc_status=`}
            />
          </CardContent>
        </Card>
        <CompanyBreakdownCard companyCountMap={companyCountMap} total={totalTickets} />
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
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">Recurring failures</h2>
            <p className="text-sm text-muted-foreground">
              Tickets that failed, went back to dev, and came back for another
              round of testing — sorted by how many times they&apos;ve failed.
            </p>
          </div>
          {recurringFailures.length > RECURRING_PREVIEW_LIMIT && (
            <Link
              href={`/tickets?recurring=1${company ? `&${companyQueryParam}` : ""}`}
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              View all ({recurringFailures.length})
              <ArrowRightIcon className="size-3.5" />
            </Link>
          )}
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
              {recurringFailures.slice(0, RECURRING_PREVIEW_LIMIT).map((ticket) => (
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
                  <TableCell className="text-right font-mono font-semibold tabular-nums text-destructive">
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

function CompanyBreakdownCard({
  companyCountMap,
  total,
}: {
  companyCountMap: Map<Company, number>;
  total: number;
}) {
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
  const companyClass: Record<Company, string> = {
    POTB: "bg-blue-600",
    GLADEX: "bg-purple-600",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Tickets by company</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
          {COMPANIES.map((company) => {
            const count = companyCountMap.get(company) ?? 0;
            const width = pct(count);
            if (width === 0) return null;
            return (
              <div
                key={company}
                className={companyClass[company]}
                style={{ width: `${width}%` }}
              />
            );
          })}
        </div>
        <div className="flex flex-col gap-1">
          {COMPANIES.map((company) => {
            const count = companyCountMap.get(company) ?? 0;
            return (
              <Link
                key={company}
                href={`/tickets?company=${company}`}
                className="-mx-2 flex items-center justify-between rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted"
              >
                <span className="flex items-center gap-2 font-medium">
                  <span className={`size-2 shrink-0 rounded-full ${companyClass[company]}`} />
                  {company}
                </span>
                <span className="font-mono tabular-nums text-muted-foreground">
                  {count}
                  <span className="ml-1.5 text-xs">{pct(count)}%</span>
                </span>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
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
      iconBg: "bg-muted text-foreground/70",
      bar: "bg-foreground/70",
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
    <Link href={href} className="block h-full">
      <Card className="h-full transition-shadow hover:shadow-md hover:ring-foreground/20">
        <CardContent className="flex h-full flex-col justify-between gap-3">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{label}</span>
              <div
                className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${toneClasses.iconBg}`}
              >
                <Icon className="size-4" />
              </div>
            </div>
            <span className="font-mono text-2xl font-semibold tabular-nums">
              {value.toLocaleString()}
            </span>
          </div>
          {percent !== undefined && (
            <div className="flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full ${toneClasses.bar}`}
                  style={{ width: `${Math.min(100, percent)}%` }}
                />
              </div>
              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                {percent}%
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
