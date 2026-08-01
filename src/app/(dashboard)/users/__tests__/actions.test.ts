import { describe, expect, it, vi, beforeEach } from "vitest";
import { eq } from "drizzle-orm";

const requireAdminMock = vi.fn();
vi.mock("@/lib/auth/roles", () => ({
  requireAdmin: () => requireAdminMock(),
}));

type ProfileRow = { id: string; role: string };

const selectFromMock = vi.fn(() => Promise.resolve([] as ProfileRow[]));
const insertValuesMock = vi.fn(() => Promise.resolve());
const updateWhereMock = vi.fn(() => Promise.resolve());
const updateSetMock = vi.fn((_values: unknown) => ({ where: updateWhereMock }));
const updateMock = vi.fn((_table: unknown) => ({ set: updateSetMock }));
const selectMock = vi.fn((_columns: unknown) => ({ from: selectFromMock }));
const insertMock = vi.fn((_table: unknown) => ({ values: insertValuesMock }));

// Note: these wrappers must stay lazy (not bare identifier references) —
// vi.mock factories are hoisted above these const declarations, so a bare
// `select: selectMock` would throw "Cannot access before initialization".
vi.mock("@/db", () => ({
  db: {
    select: (_columns: unknown) => selectMock(_columns),
    insert: (_table: unknown) => insertMock(_table),
    update: (_table: unknown) => updateMock(_table),
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const createAdminClientMock = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => createAdminClientMock(),
}));

import { createUserAccount, updateUserRole } from "../actions";
import { profiles } from "@/db/schema";

const VIEWER_ERROR = { error: "You don't have permission to do this." };

beforeEach(() => {
  requireAdminMock.mockReset();
  requireAdminMock.mockResolvedValue(VIEWER_ERROR);
  createAdminClientMock.mockReset();
  selectFromMock.mockReset();
  selectFromMock.mockResolvedValue([]);
  updateMock.mockClear();
  updateSetMock.mockClear();
  updateWhereMock.mockClear();
});

describe("users actions reject non-admins", () => {
  it("createUserAccount", async () => {
    const fd = new FormData();
    fd.set("email", "new@example.com");
    fd.set("password", "password123");
    fd.set("role", "viewer");
    expect(await createUserAccount({ error: null }, fd)).toEqual(VIEWER_ERROR);
    expect(createAdminClientMock).not.toHaveBeenCalled();
  });

  it("updateUserRole", async () => {
    expect(await updateUserRole("u1", "admin")).toEqual(VIEWER_ERROR);
  });
});

describe("updateUserRole as admin", () => {
  beforeEach(() => {
    requireAdminMock.mockResolvedValue({ error: null });
  });

  it("blocks demoting the last remaining admin", async () => {
    selectFromMock.mockResolvedValue([
      { id: "admin1", role: "admin" },
      { id: "viewer1", role: "viewer" },
    ]);

    const result = await updateUserRole("admin1", "viewer");

    expect(result).toEqual({
      error: "Can't remove the last remaining admin.",
    });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("allows demoting a non-last admin and persists the change", async () => {
    selectFromMock.mockResolvedValue([
      { id: "admin1", role: "admin" },
      { id: "admin2", role: "admin" },
      { id: "viewer1", role: "viewer" },
    ]);

    const result = await updateUserRole("admin1", "viewer");

    expect(result).toEqual({ error: null });
    expect(updateMock).toHaveBeenCalledWith(profiles);
    expect(updateSetMock).toHaveBeenCalledWith({ role: "viewer" });
    expect(updateWhereMock).toHaveBeenCalledWith(eq(profiles.id, "admin1"));
  });
});
