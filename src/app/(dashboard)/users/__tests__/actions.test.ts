import { describe, expect, it, vi, beforeEach } from "vitest";

const requireAdminMock = vi.fn();
vi.mock("@/lib/auth/roles", () => ({
  requireAdmin: () => requireAdminMock(),
}));
vi.mock("@/db", () => ({
  db: {
    select: vi.fn(() => ({ from: vi.fn(() => Promise.resolve([])) })),
    insert: vi.fn(() => ({ values: vi.fn(() => Promise.resolve()) })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })) })),
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const createAdminClientMock = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => createAdminClientMock(),
}));

import { createUserAccount, updateUserRole } from "../actions";

const VIEWER_ERROR = { error: "You don't have permission to do this." };

beforeEach(() => {
  requireAdminMock.mockReset();
  requireAdminMock.mockResolvedValue(VIEWER_ERROR);
  createAdminClientMock.mockReset();
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
