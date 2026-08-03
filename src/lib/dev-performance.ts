import type { TicketStatus } from "@/lib/validations";

export interface DevPerformance {
  dev: string;
  total: number;
  passed: number;
  failed: number;
  recurring: number;
}

/**
 * Groups by a case-/whitespace-insensitive key so "Mark" and "mark" count as
 * one dev instead of splitting one person's tickets across two rows. The
 * display name shown for the group is whichever casing appeared most often.
 */
export function computeDevPerformance(
  rows: { dev: string | null; ticketStatus: TicketStatus; failedCounter: number }[]
): DevPerformance[] {
  const byDev = new Map<
    string,
    DevPerformance & { nameCounts: Map<string, number> }
  >();

  for (const row of rows) {
    const trimmed = row.dev?.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();

    const entry = byDev.get(key) ?? {
      dev: trimmed,
      total: 0,
      passed: 0,
      failed: 0,
      recurring: 0,
      nameCounts: new Map<string, number>(),
    };

    entry.total += 1;
    if (row.ticketStatus === "PASSED") entry.passed += 1;
    if (row.ticketStatus === "FAILED") entry.failed += 1;
    if (row.failedCounter > 0) entry.recurring += 1;
    entry.nameCounts.set(trimmed, (entry.nameCounts.get(trimmed) ?? 0) + 1);

    byDev.set(key, entry);
  }

  return Array.from(byDev.values()).map(({ nameCounts, ...entry }) => {
    let displayName = entry.dev;
    let bestCount = 0;
    for (const [name, count] of nameCounts) {
      if (count > bestCount) {
        bestCount = count;
        displayName = name;
      }
    }
    return { ...entry, dev: displayName };
  });
}

/** Dedupes a list of dev names case-/whitespace-insensitively, for filter dropdowns. */
export function dedupeDevNames(names: string[]): string[] {
  const seen = new Map<string, string>();
  for (const raw of names) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (!seen.has(key)) seen.set(key, trimmed);
  }
  return Array.from(seen.values()).sort();
}

/**
 * Recurring failures count against the rate even though the ticket is
 * currently PASSED — a ticket that needed 3 rounds to pass shouldn't score
 * the same as one that passed first try. Each recurring failure is treated
 * as an extra attempt in the denominator, so more rework pulls the rate down.
 */
export function computePassRate(passed: number, total: number, recurring: number): number {
  const denominator = total + recurring;
  return denominator > 0 ? Math.round((passed / denominator) * 100) : 0;
}

export function passRate(dev: DevPerformance): number {
  return computePassRate(dev.passed, dev.total, dev.recurring);
}

export function sortByHighPerformance(devs: DevPerformance[]): DevPerformance[] {
  return [...devs].sort((a, b) => b.passed - a.passed);
}

export function sortByLowPerformance(devs: DevPerformance[]): DevPerformance[] {
  return [...devs].sort(
    (a, b) => b.failed + b.recurring - (a.failed + a.recurring)
  );
}

export interface WeeklyTrendPoint {
  weekStart: string;
  total: number;
  passed: number;
  failed: number;
  passRate: number;
  recurring: number;
}

function startOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  return d;
}

function toDateOnly(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Buckets tickets by the Monday-start week they were created in, for the
 * last `weeks` calendar weeks ending at `now` — including weeks with zero
 * tickets, so a quiet week shows as zero rather than a gap in the series.
 */
export function computeWeeklyTrend(
  rows: { createdAt: Date; ticketStatus: TicketStatus; failedCounter: number }[],
  now: Date,
  weeks = 12
): WeeklyTrendPoint[] {
  const buckets = new Map<
    string,
    { total: number; passed: number; failed: number; recurring: number }
  >();

  for (const row of rows) {
    const key = toDateOnly(startOfWeek(row.createdAt));
    const bucket = buckets.get(key) ?? { total: 0, passed: 0, failed: 0, recurring: 0 };
    bucket.total += 1;
    if (row.ticketStatus === "PASSED") bucket.passed += 1;
    if (row.ticketStatus === "FAILED") bucket.failed += 1;
    if (row.failedCounter > 0) bucket.recurring += 1;
    buckets.set(key, bucket);
  }

  const currentWeekStart = startOfWeek(now);
  const points: WeeklyTrendPoint[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = new Date(currentWeekStart);
    weekStart.setDate(weekStart.getDate() - i * 7);
    const key = toDateOnly(weekStart);
    const bucket = buckets.get(key) ?? { total: 0, passed: 0, failed: 0, recurring: 0 };
    points.push({
      weekStart: key,
      total: bucket.total,
      passed: bucket.passed,
      failed: bucket.failed,
      passRate: computePassRate(bucket.passed, bucket.total, bucket.recurring),
      recurring: bucket.recurring,
    });
  }
  return points;
}
