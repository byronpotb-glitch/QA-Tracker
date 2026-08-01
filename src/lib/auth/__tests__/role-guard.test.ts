import { describe, expect, it } from "vitest";
import { canChangeRole, resolveRole } from "@/lib/auth/role-guard";

describe("resolveRole", () => {
  it("returns the profile's role when a row exists", () => {
    expect(resolveRole({ role: "admin" })).toBe("admin");
    expect(resolveRole({ role: "viewer" })).toBe("viewer");
  });

  it("defaults to viewer when there is no profile row", () => {
    expect(resolveRole(undefined)).toBe("viewer");
  });
});

describe("canChangeRole", () => {
  const admin = { id: "a1", role: "admin" as const };
  const viewer = { id: "v1", role: "viewer" as const };

  it("allows promoting a viewer to admin", () => {
    expect(canChangeRole([admin, viewer], "v1", "admin")).toBe(true);
  });

  it("allows demoting an admin when another admin remains", () => {
    const admin2 = { id: "a2", role: "admin" as const };
    expect(canChangeRole([admin, admin2, viewer], "a1", "viewer")).toBe(true);
  });

  it("blocks demoting the last remaining admin", () => {
    expect(canChangeRole([admin, viewer], "a1", "viewer")).toBe(false);
  });

  it("allows re-confirming the last admin's role as admin", () => {
    expect(canChangeRole([admin, viewer], "a1", "admin")).toBe(true);
  });
});
