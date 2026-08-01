import { describe, expect, it, vi, beforeEach } from "vitest";

const getUserMock = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve({ auth: { getUser: () => getUserMock() } }),
}));

const findFirstMock = vi.fn();
vi.mock("@/db", () => ({
  db: { query: { profiles: { findFirst: (args: unknown) => findFirstMock(args) } } },
}));

import { getCurrentUser, requireAdmin } from "../roles";

const DENIED = { error: "You don't have permission to do this." };

beforeEach(() => {
  getUserMock.mockReset();
  findFirstMock.mockReset();
});

describe("getCurrentUser / requireAdmin", () => {
  it("returns null and denies when there is no Supabase session", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });

    expect(await getCurrentUser()).toBeNull();
    expect(await requireAdmin()).toEqual(DENIED);
    expect(findFirstMock).not.toHaveBeenCalled();
  });

  it("defaults to viewer (deny-by-default) when session exists but no profile row is found", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-1", email: "user1@example.com" } },
    });
    findFirstMock.mockResolvedValue(undefined);

    const user = await getCurrentUser();
    expect(user).toEqual({
      id: "user-1",
      email: "user1@example.com",
      role: "viewer",
    });
    expect(await requireAdmin()).toEqual(DENIED);
  });

  it("denies when the profile row has role 'viewer'", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-2", email: "user2@example.com" } },
    });
    findFirstMock.mockResolvedValue({ id: "user-2", role: "viewer" });

    expect(await requireAdmin()).toEqual(DENIED);
  });

  it("allows and returns full user data when the profile row has role 'admin'", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-3", email: "user3@example.com" } },
    });
    findFirstMock.mockResolvedValue({ id: "user-3", role: "admin" });

    expect(await requireAdmin()).toEqual({ error: null });
    expect(await getCurrentUser()).toEqual({
      id: "user-3",
      email: "user3@example.com",
      role: "admin",
    });
  });
});
