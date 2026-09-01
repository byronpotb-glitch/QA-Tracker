import { and, eq, gte, lt } from "drizzle-orm";
import {
  TicketIcon,
  CheckCircle2Icon,
  XCircleIcon,
  RefreshCcwIcon,
  TrendingUpIcon,
  TrendingDownIcon,
} from "lucide-react";
import { db } from "@/db";
import { tickets } from "@/db/schema";
import { DashboardCompanyFilter } from "../dashboard/company-filter";
import { MetricComparisonTile } from "./metric-comparison-tile";
import { DevMoversCard } from "./dev-movers-card";
import { PeriodToggle } from "./period-toggle";
import { ExportSummaryButton } from "./export-summary-button";
import {
  getPeriodRanges,
  computePeriodStats,
  computeDevMovers,
  type Period,
} from "@/lib/period-comparison";
import type { Company } from "@/lib/validations";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

export default async function SummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; company?: string }>;
}) {
  const params = await searchParams;
  const period: Period = params.period === "month" ? "month" : "week";
  const company: Company | undefined =
    params.company === "POTB" || params.company === "GLADEX" ? params.company : undefined;

  const now = new Date();
  const { currentStart, currentEnd, previousStart, previousEnd } = getPeriodRanges(period, now);

  const conditions = [
    gte(tickets.createdAt, previousStart),
    lt(tickets.createdAt, currentEnd),
    company ? eq(tickets.company, company) : undefined,
  ].filter((c) => c !== undefined);

  const rows = await db
    .select({
      dev: tickets.dev,
      ticketStatus: tickets.ticketStatus,
      failedCounter: tickets.failedCounter,
      createdAt: tickets.createdAt,
    })
    .from(tickets)
    .where(and(...conditions));

  const currentRows = rows.filter((r) => r.createdAt >= currentStart);
  const previousRows = rows.filter(
    (r) => r.createdAt >= previousStart && r.createdAt < previousEnd
  );

  const currentStats = computePeriodStats(currentRows);
  const previousStats = computePeriodStats(previousRows);
  const movers = computeDevMovers(currentRows, previousRows);
  const improved = [...movers]
    .filter((m) => m.delta > 0)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 3);
  const declined = [...movers]
    .filter((m) => m.delta < 0)
    .sort((a, b) => a.delta - b.delta)
    .slice(0, 3);

  const periodLabel = period === "week" ? "last week" : "last month";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">Summary</h1>
          <p className="text-sm text-muted-foreground">
            {dateFormatter.format(currentStart)}–{dateFormatter.format(currentEnd)} vs{" "}
            {dateFormatter.format(previousStart)}–{dateFormatter.format(previousEnd)} (
            {periodLabel})
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DashboardCompanyFilter company={company} />
          <PeriodToggle period={period} />
          <ExportSummaryButton
            periodLabel={periodLabel}
            currentStats={currentStats}
            previousStats={previousStats}
            movers={movers}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricComparisonTile
          label="Tickets tested"
          icon={TicketIcon}
          current={currentStats.total}
          previous={previousStats.total}
          higherIsBetter
          periodLabel={periodLabel}
          href="/tickets"
        />
        <MetricComparisonTile
          label="Pass rate"
          icon={CheckCircle2Icon}
          current={currentStats.passRate}
          previous={previousStats.passRate}
          unit="percent"
          higherIsBetter
          periodLabel={periodLabel}
          href="/dev-performance"
        />
        <MetricComparisonTile
          label="Failed tickets"
          icon={XCircleIcon}
          current={currentStats.failed}
          previous={previousStats.failed}
          higherIsBetter={false}
          periodLabel={periodLabel}
          href="/tickets?status=FAILED"
        />
        <MetricComparisonTile
          label="Recurring failures"
          icon={RefreshCcwIcon}
          current={currentStats.recurring}
          previous={previousStats.recurring}
          higherIsBetter={false}
          periodLabel={periodLabel}
          href="/tickets?recurring=1"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <DevMoversCard
          title="Most improved"
          icon={TrendingUpIcon}
          iconClassName="text-green-600 dark:text-green-400"
          movers={improved}
          emptyMessage={`No dev's pass rate improved vs ${periodLabel}.`}
        />
        <DevMoversCard
          title="Needs attention"
          icon={TrendingDownIcon}
          iconClassName="text-destructive"
          movers={declined}
          emptyMessage={`No dev's pass rate dropped vs ${periodLabel}.`}
        />
      </div>
    </div>
  );
}
