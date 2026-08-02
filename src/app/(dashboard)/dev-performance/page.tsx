import { and, gte, lte } from "drizzle-orm";
import { TrendingUpIcon, TrendingDownIcon } from "lucide-react";
import { db } from "@/db";
import { tickets } from "@/db/schema";
import { Card, CardContent } from "@/components/ui/card";
import {
  computeDevPerformance,
  sortByHighPerformance,
  sortByLowPerformance,
} from "@/lib/dev-performance";
import { DevMiniList } from "../dev-mini-list";
import { DashboardDateFilter, type DateField } from "../dashboard/date-filter";
import { AllDevsTable } from "./all-devs-table";

export const dynamic = "force-dynamic";

export default async function DevPerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; field?: string }>;
}) {
  const params = await searchParams;
  const dateField: DateField = params.field === "updated" ? "updated" : "created";
  const dateColumn = dateField === "updated" ? tickets.updatedAt : tickets.createdAt;

  const dateRange =
    params.from && params.to
      ? {
          from: new Date(`${params.from}T00:00:00`),
          to: new Date(`${params.to}T23:59:59.999`),
        }
      : null;

  const rows = await db
    .select({
      dev: tickets.dev,
      ticketStatus: tickets.ticketStatus,
      failedCounter: tickets.failedCounter,
    })
    .from(tickets)
    .where(
      dateRange ? and(gte(dateColumn, dateRange.from), lte(dateColumn, dateRange.to)) : undefined
    );

  const performance = computeDevPerformance(rows);
  const topPerformers = sortByHighPerformance(
    performance.filter((d) => d.passed > 0)
  ).slice(0, 2);
  const needsAttention = sortByLowPerformance(performance).slice(0, 2);
  const allDevs = [...performance].sort((a, b) => b.total - a.total);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">Dev Performance</h1>
          <p className="text-sm text-muted-foreground">
            Tickets grouped by assigned dev — click any number to see the
            underlying tickets.
          </p>
        </div>
        <DashboardDateFilter from={params.from} to={params.to} field={dateField} />
      </div>

      {performance.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No tickets have a dev assigned yet.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <DevMiniList
              title="High Performance"
              icon={TrendingUpIcon}
              iconClassName="text-green-600 dark:text-green-400"
              devs={topPerformers}
              metric="passed"
            />
            <DevMiniList
              title="Low Performance"
              icon={TrendingDownIcon}
              iconClassName="text-destructive"
              devs={needsAttention}
              metric="failed"
            />
          </div>

          <div className="flex flex-col gap-3">
            <h2 className="text-base font-semibold">All Devs</h2>
            <AllDevsTable devs={allDevs} />
          </div>
        </>
      )}
    </div>
  );
}
