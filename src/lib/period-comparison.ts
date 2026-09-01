import type { TicketStatus } from "@/lib/validations";
import { computeDevPerformance, computePassRate, dedupeDevNames } from "@/lib/dev-performance";

export type Period = "week" | "month";

export interface PeriodRanges {
  currentStart: Date;
  currentEnd: Date;
  previousStart: Date;
  previousEnd: Date;
}

function startOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  return d;
}

/**
 * Both periods span the same elapsed duration (not full calendar units), so
 * a partial current week/month is compared fairly against the equivalent
 * partial window from the prior week/month, rather than against a full one.
 */
export function getPeriodRanges(period: Period, now: Date): PeriodRanges {
  const currentStart =
    period === "week" ? startOfWeek(now) : new Date(now.getFullYear(), now.getMonth(), 1);
  const elapsedMs = now.getTime() - currentStart.getTime();

  const previousStart =
    period === "week"
      ? new Date(currentStart.getTime() - 7 * 24 * 60 * 60 * 1000)
      : new Date(currentStart.getFullYear(), currentStart.getMonth() - 1, 1);
  const previousEnd = new Date(previousStart.getTime() + elapsedMs);

  return { currentStart, currentEnd: now, previousStart, previousEnd };
}

export interface PeriodStats {
  total: number;
  passed: number;
  failed: number;
  recurring: number;
  passRate: number;
}

export function computePeriodStats(
  rows: { ticketStatus: TicketStatus; failedCounter: number }[]
): PeriodStats {
  let passed = 0;
  let failed = 0;
  let recurring = 0;
  for (const row of rows) {
    if (row.ticketStatus === "PASSED") passed += 1;
    if (row.ticketStatus === "FAILED") failed += 1;
    if (row.failedCounter > 0) recurring += 1;
  }
  return {
    total: rows.length,
    passed,
    failed,
    recurring,
    passRate: computePassRate(passed, rows.length, recurring),
  };
}

export interface DevMover {
  dev: string;
  previousRate: number;
  currentRate: number;
  delta: number;
}

/**
 * Pass-rate delta per dev between two periods, for devs with at least one
 * ticket in both — a dev with no prior-period data has no baseline to move
 * against, so they're excluded rather than shown with a misleading delta.
 */
export function computeDevMovers(
  currentRows: { dev: string | null; ticketStatus: TicketStatus; failedCounter: number }[],
  previousRows: { dev: string | null; ticketStatus: TicketStatus; failedCounter: number }[]
): DevMover[] {
  const current = computeDevPerformance(currentRows);
  const previous = computeDevPerformance(previousRows);

  const previousByKey = new Map(previous.map((d) => [d.dev.toLowerCase(), d]));
  const currentByKey = new Map(current.map((d) => [d.dev.toLowerCase(), d]));

  const names = dedupeDevNames([...current, ...previous].map((d) => d.dev));

  const movers: DevMover[] = [];
  for (const name of names) {
    const key = name.toLowerCase();
    const cur = currentByKey.get(key);
    const prev = previousByKey.get(key);
    if (!cur || !prev) continue;
    const currentRate = computePassRate(cur.passed, cur.total, cur.recurring);
    const previousRate = computePassRate(prev.passed, prev.total, prev.recurring);
    movers.push({ dev: name, previousRate, currentRate, delta: currentRate - previousRate });
  }
  return movers;
}
