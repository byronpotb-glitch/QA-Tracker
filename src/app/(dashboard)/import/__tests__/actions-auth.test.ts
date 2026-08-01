import { describe, expect, it, vi, beforeEach } from "vitest";

const requireAdminMock = vi.fn();
vi.mock("@/lib/auth/roles", () => ({
  requireAdmin: () => requireAdminMock(),
}));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { previewExcelImport, applyExcelImport, cleanupExcelImport } from "../actions";

const VIEWER_ERROR = { error: "You don't have permission to do this." };

beforeEach(() => {
  requireAdminMock.mockReset();
  requireAdminMock.mockResolvedValue(VIEWER_ERROR);
});

describe("import actions reject viewers", () => {
  it("previewExcelImport", async () => {
    const result = await previewExcelImport(new FormData());
    expect(result.fileErrors).toEqual([VIEWER_ERROR.error]);
  });

  it("applyExcelImport", async () => {
    expect(await applyExcelImport(new FormData())).toEqual(VIEWER_ERROR);
  });

  it("cleanupExcelImport", async () => {
    const result = await cleanupExcelImport(new FormData());
    expect(result.fileErrors).toEqual([VIEWER_ERROR.error]);
  });
});
