import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { resolveRole, type Role } from "@/lib/auth/role-guard";

export type { Role };
export { resolveRole };

export interface CurrentUser {
  id: string;
  email: string;
  role: Role;
}

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.id, user.id),
  });

  return {
    id: user.id,
    email: user.email ?? "",
    role: resolveRole(profile),
  };
});

export interface RoleCheckResult {
  error: string | null;
}

export async function requireAdmin(): Promise<RoleCheckResult> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return { error: "You don't have permission to do this." };
  }
  return { error: null };
}
