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

export function passRate(dev: DevPerformance): number {
  return dev.total > 0 ? Math.round((dev.passed / dev.total) * 100) : 0;
}

export function sortByHighPerformance(devs: DevPerformance[]): DevPerformance[] {
  return [...devs].sort((a, b) => b.passed - a.passed);
}

export function sortByLowPerformance(devs: DevPerformance[]): DevPerformance[] {
  return [...devs].sort(
    (a, b) => b.failed + b.recurring - (a.failed + a.recurring)
  );
}
