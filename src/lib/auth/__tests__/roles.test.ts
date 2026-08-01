import { describe, expect, it } from "vitest";
import { resolveRole } from "@/lib/auth/roles";

describe("resolveRole", () => {
  it("returns the profile's role when a row exists", () => {
    expect(resolveRole({ role: "admin" })).toBe("admin");
    expect(resolveRole({ role: "viewer" })).toBe("viewer");
  });

  it("defaults to viewer when there is no profile row", () => {
    expect(resolveRole(undefined)).toBe("viewer");
  });
});
