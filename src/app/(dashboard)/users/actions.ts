"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { requireAdmin, type Role } from "@/lib/auth/roles";
import { canChangeRole } from "@/lib/auth/role-guard";
import { createAdminClient } from "@/lib/supabase/admin";

export interface ActionResult {
  error: string | null;
}

export async function createUserAccount(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const roleCheck = await requireAdmin();
  if (roleCheck.error) return roleCheck;

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role: Role = formData.get("role") === "admin" ? "admin" : "viewer";

  if (!email) return { error: "Email is required." };
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error || !data.user) {
    return { error: error?.message ?? "Failed to create user." };
  }

  await db.insert(profiles).values({ id: data.user.id, email, role });

  revalidatePath("/users");
  return { error: null };
}

export async function updateUserRole(
  userId: string,
  role: Role
): Promise<ActionResult> {
  const roleCheck = await requireAdmin();
  if (roleCheck.error) return roleCheck;

  const allProfiles = await db
    .select({ id: profiles.id, role: profiles.role })
    .from(profiles);

  if (!canChangeRole(allProfiles, userId, role)) {
    return { error: "Can't remove the last remaining admin." };
  }

  await db.update(profiles).set({ role }).where(eq(profiles.id, userId));

  revalidatePath("/users");
  return { error: null };
}
