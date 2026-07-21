import { describe, expect, it } from "vitest";
import { applyRollup, computeRollupStatus } from "@/lib/rollup";
import type { TestCaseStatus } from "@/lib/validations";

describe("computeRollupStatus", () => {
  it("returns FAILED when any test case is FAILED", () => {
    const statuses: TestCaseStatus[] = ["PASSED", "FAILED", "PASSED"];
    expect(computeRollupStatus(statuses)).toBe("FAILED");
  });

  it("FAILED takes priority even alongside IN_PROGRESS/NOT_TESTED", () => {
    const statuses: TestCaseStatus[] = ["IN_PROGRESS", "FAILED", "NOT_TESTED"];
    expect(computeRollupStatus(statuses)).toBe("FAILED");
  });

  it("returns IN_PROGRESS when any test case is IN_PROGRESS", () => {
    expect(computeRollupStatus(["PASSED", "IN_PROGRESS"])).toBe("IN_PROGRESS");
  });

  it("returns IN_PROGRESS when any test case is NOT_TESTED", () => {
    expect(computeRollupStatus(["PASSED", "NOT_TESTED"])).toBe("IN_PROGRESS");
  });

  it("returns PASSED when all test cases are PASSED", () => {
    expect(computeRollupStatus(["PASSED", "PASSED"])).toBe("PASSED");
  });

  it("ignores ON_HOLD/PENDING test cases when computing PASSED", () => {
    expect(computeRollupStatus(["PASSED", "ON_HOLD", "PENDING"])).toBe(
      "PASSED"
    );
  });

  it("ignores ON_HOLD/PENDING test cases when computing FAILED/IN_PROGRESS", () => {
    expect(computeRollupStatus(["FAILED", "ON_HOLD"])).toBe("FAILED");
    expect(computeRollupStatus(["IN_PROGRESS", "PENDING"])).toBe(
      "IN_PROGRESS"
    );
  });

  it("returns null when there are no test cases", () => {
    expect(computeRollupStatus([])).toBeNull();
  });

  it("returns null when every test case is ON_HOLD/PENDING", () => {
    expect(computeRollupStatus(["ON_HOLD", "PENDING", "ON_HOLD"])).toBeNull();
  });
});

describe("applyRollup", () => {
  it("computes FAILED and increments failedCounter on entering FAILED", () => {
    const result = applyRollup({
      currentStatus: "IN_PROGRESS",
      manualOverride: false,
      failedCounter: 0,
      testCaseStatuses: ["FAILED", "PASSED"],
    });
    expect(result).toEqual({ ticketStatus: "FAILED", failedCounter: 1 });
  });

  it("does not increment failedCounter if ticket is already FAILED", () => {
    const result = applyRollup({
      currentStatus: "FAILED",
      manualOverride: false,
      failedCounter: 2,
      testCaseStatuses: ["FAILED", "FAILED"],
    });
    expect(result).toEqual({ ticketStatus: "FAILED", failedCounter: 2 });
  });

  it("increments failedCounter each time the ticket re-enters FAILED", () => {
    const first = applyRollup({
      currentStatus: "PASSED",
      manualOverride: false,
      failedCounter: 1,
      testCaseStatuses: ["FAILED"],
    });
    expect(first).toEqual({ ticketStatus: "FAILED", failedCounter: 2 });

    const recovered = applyRollup({
      currentStatus: first.ticketStatus,
      manualOverride: false,
      failedCounter: first.failedCounter,
      testCaseStatuses: ["PASSED"],
    });
    expect(recovered).toEqual({ ticketStatus: "PASSED", failedCounter: 2 });

    const failsAgain = applyRollup({
      currentStatus: recovered.ticketStatus,
      manualOverride: false,
      failedCounter: recovered.failedCounter,
      testCaseStatuses: ["FAILED"],
    });
    expect(failsAgain).toEqual({ ticketStatus: "FAILED", failedCounter: 3 });
  });

  it("leaves status/counter untouched when manualOverride is true", () => {
    const result = applyRollup({
      currentStatus: "ON_HOLD",
      manualOverride: true,
      failedCounter: 5,
      testCaseStatuses: ["FAILED", "FAILED"],
    });
    expect(result).toEqual({ ticketStatus: "ON_HOLD", failedCounter: 5 });
  });

  it("leaves status untouched when computeRollupStatus can't decide", () => {
    const result = applyRollup({
      currentStatus: "PENDING",
      manualOverride: false,
      failedCounter: 0,
      testCaseStatuses: ["ON_HOLD", "PENDING"],
    });
    expect(result).toEqual({ ticketStatus: "PENDING", failedCounter: 0 });
  });
});
