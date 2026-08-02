"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/roles";

export interface ActionResult {
  error: string | null;
}

export async function createProject(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const roleCheck = await requireAdmin();
  if (roleCheck.error) return roleCheck;

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name is required." };

  const existing = await db.query.projects.findFirst({
    where: (p, { eq }) => eq(p.name, name),
  });
  if (existing) return { error: `A project named "${name}" already exists.` };

  await db.insert(projects).values({ name });

  revalidatePath("/projects");
  return { error: null };
}
