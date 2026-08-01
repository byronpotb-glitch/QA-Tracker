export type Role = "admin" | "viewer";

/**
 * Blocks demoting the last remaining admin — everything else is allowed.
 */
export function canChangeRole(
  allProfiles: { id: string; role: Role }[],
  targetId: string,
  nextRole: Role
): boolean {
  if (nextRole === "admin") return true;

  const target = allProfiles.find((p) => p.id === targetId);
  if (!target || target.role !== "admin") return true;

  const adminCount = allProfiles.filter((p) => p.role === "admin").length;
  return adminCount > 1;
}
