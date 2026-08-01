import { describe, expect, it, vi, beforeEach } from "vitest";

const requireAdminMock = vi.fn();
vi.mock("@/lib/auth/roles", () => ({
  requireAdmin: () => requireAdminMock(),
}));

const dbMock = vi.hoisted(() => ({
  insert: vi.fn(() => { throw new Error("db.insert should not be called for a viewer"); }),
  update: vi.fn(() => { throw new Error("db.update should not be called for a viewer"); }),
  delete: vi.fn(() => { throw new Error("db.delete should not be called for a viewer"); }),
  query: { tickets: { findFirst: vi.fn() } },
  transaction: vi.fn(() => { throw new Error("db.transaction should not be called for a viewer"); }),
}));
vi.mock("@/db", () => ({ db: dbMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import {
  addTestCase,
  updateTestCase,
  updateTestCaseStatus,
  deleteTestCase,
  toggleManualOverride,
  setTicketStatus,
  setTicketDev,
  setTicketCreatedAt,
  retestTicket,
} from "../actions";

const VIEWER_ERROR = { error: "You don't have permission to do this." };

beforeEach(() => {
  requireAdminMock.mockReset();
  requireAdminMock.mockResolvedValue(VIEWER_ERROR);
});

describe("write actions reject viewers", () => {
  it("addTestCase", async () => {
    const fd = new FormData();
    expect(await addTestCase("t1", fd)).toEqual(VIEWER_ERROR);
  });

  it("updateTestCase", async () => {
    const fd = new FormData();
    expect(await updateTestCase("t1", "tc1", fd)).toEqual(VIEWER_ERROR);
  });

  it("updateTestCaseStatus", async () => {
    expect(await updateTestCaseStatus("t1", "tc1", "PASSED")).toEqual(VIEWER_ERROR);
  });

  it("deleteTestCase", async () => {
    expect(await deleteTestCase("t1", "tc1")).toEqual(VIEWER_ERROR);
  });

  it("toggleManualOverride", async () => {
    expect(await toggleManualOverride("t1", true)).toEqual(VIEWER_ERROR);
  });

  it("setTicketStatus", async () => {
    expect(await setTicketStatus("t1", "PASSED")).toEqual(VIEWER_ERROR);
  });

  it("setTicketDev", async () => {
    expect(await setTicketDev("t1", "alice")).toEqual(VIEWER_ERROR);
  });

  it("setTicketCreatedAt", async () => {
    expect(await setTicketCreatedAt("t1", "2026-01-01")).toEqual(VIEWER_ERROR);
  });

  it("retestTicket", async () => {
    expect(await retestTicket("t1")).toEqual(VIEWER_ERROR);
  });
});
