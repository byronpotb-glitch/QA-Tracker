import type { TestCaseStatus, TicketStatus } from "@/lib/validations";

/** Statuses the automatic rollup can produce. ON_HOLD/PENDING are manual-only. */
export type ComputedTicketStatus = "PASSED" | "FAILED" | "IN_PROGRESS";

/**
 * Rollup rule:
 *   - any FAILED test case            -> FAILED
 *   - else any IN_PROGRESS/NOT_TESTED -> IN_PROGRESS
 *   - else all remaining are PASSED   -> PASSED
 * Test cases sitting at ON_HOLD/PENDING are ignored (neither pass nor fail
 * the rollup) since only tickets are manually set to those statuses.
 * Returns null when no automatic status can be determined - i.e. there are
 * no test cases, or every test case is ON_HOLD/PENDING - in which case the
 * ticket's current status should be left untouched.
 */
export function computeRollupStatus(
  testCaseStatuses: TestCaseStatus[]
): ComputedTicketStatus | null {
  if (testCaseStatuses.some((status) => status === "FAILED")) {
    return "FAILED";
  }

  if (
    testCaseStatuses.some(
      (status) => status === "IN_PROGRESS" || status === "NOT_TESTED"
    )
  ) {
    return "IN_PROGRESS";
  }

  const relevant = testCaseStatuses.filter(
    (status) => status !== "ON_HOLD" && status !== "PENDING"
  );

  if (relevant.length > 0 && relevant.every((status) => status === "PASSED")) {
    return "PASSED";
  }

  return null;
}

export interface RollupInput {
  currentStatus: TicketStatus;
  manualOverride: boolean;
  failedCounter: number;
  testCaseStatuses: TestCaseStatus[];
}

export interface RollupOutput {
  ticketStatus: TicketStatus;
  failedCounter: number;
}

/**
 * Applies the rollup rule to produce the next ticket status/failedCounter.
 * Call this whenever a test case is created, edited, or deleted.
 */
export function applyRollup(input: RollupInput): RollupOutput {
  if (input.manualOverride) {
    return {
      ticketStatus: input.currentStatus,
      failedCounter: input.failedCounter,
    };
  }

  const computed = computeRollupStatus(input.testCaseStatuses);

  if (computed === null) {
    return {
      ticketStatus: input.currentStatus,
      failedCounter: input.failedCounter,
    };
  }

  const enteringFailed = computed === "FAILED" && input.currentStatus !== "FAILED";

  return {
    ticketStatus: computed,
    failedCounter: enteringFailed
      ? input.failedCounter + 1
      : input.failedCounter,
  };
}
