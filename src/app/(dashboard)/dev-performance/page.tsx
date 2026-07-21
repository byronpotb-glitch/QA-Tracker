import Link from "next/link";
import { TrendingUpIcon, TrendingDownIcon } from "lucide-react";
import { db } from "@/db";
import { tickets } from "@/db/schema";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  computeDevPerformance,
  sortByHighPerformance,
  sortByLowPerformance,
} from "@/lib/dev-performance";
import { DevMiniList } from "../dev-mini-list";

export const dynamic = "force-dynamic";

export default async function DevPerformancePage() {
  const rows = await db
    .select({
      dev: tickets.dev,
      ticketStatus: tickets.ticketStatus,
      failedCounter: tickets.failedCounter,
    })
    .from(tickets);

  const performance = computeDevPerformance(rows);
  const topPerformers = sortByHighPerformance(
    performance.filter((d) => d.passed > 0)
  ).slice(0, 2);
  const needsAttention = sortByLowPerformance(performance).slice(0, 2);
  const allDevs = [...performance].sort((a, b) => b.total - a.total);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold">Dev Performance</h1>
        <p className="text-sm text-muted-foreground">
          Tickets grouped by assigned dev — click any number to see the
          underlying tickets.
        </p>
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
            <div className="rounded-xl ring-1 ring-foreground/10">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dev</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Passed</TableHead>
                    <TableHead className="text-right">Failed</TableHead>
                    <TableHead className="text-right">Recurring</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allDevs.map((d) => {
                    const base = `/tickets?dev=${encodeURIComponent(d.dev)}`;
                    return (
                      <TableRow key={d.dev}>
                        <TableCell className="font-medium">
                          <Link href={base} className="hover:underline">
                            {d.dev}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right">
                          <Link href={base} className="hover:underline">
                            {d.total}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right text-green-600 dark:text-green-400">
                          <Link href={`${base}&status=PASSED`} className="hover:underline">
                            {d.passed}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right text-destructive">
                          <Link href={`${base}&status=FAILED`} className="hover:underline">
                            {d.failed}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right text-amber-600 dark:text-amber-400">
                          <Link href={`${base}&recurring=1`} className="hover:underline">
                            {d.recurring}
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
