import type { TicketStatus } from "@/lib/validations";

export interface DevPerformance {
  dev: string;
  total: number;
  passed: number;
  failed: number;
  recurring: number;
}

export function computeDevPerformance(
  rows: { dev: string | null; ticketStatus: TicketStatus; failedCounter: number }[]
): DevPerformance[] {
  const byDev = new Map<string, DevPerformance>();

  for (const row of rows) {
    if (!row.dev) continue;

    const entry = byDev.get(row.dev) ?? {
      dev: row.dev,
      total: 0,
      passed: 0,
      failed: 0,
      recurring: 0,
    };

    entry.total += 1;
    if (row.ticketStatus === "PASSED") entry.passed += 1;
    if (row.ticketStatus === "FAILED") entry.failed += 1;
    if (row.failedCounter > 0) entry.recurring += 1;

    byDev.set(row.dev, entry);
  }

  return Array.from(byDev.values());
}

export function sortByHighPerformance(devs: DevPerformance[]): DevPerformance[] {
  return [...devs].sort((a, b) => b.passed - a.passed);
}

export function sortByLowPerformance(devs: DevPerformance[]): DevPerformance[] {
  return [...devs].sort(
    (a, b) => b.failed + b.recurring - (a.failed + a.recurring)
  );
}
