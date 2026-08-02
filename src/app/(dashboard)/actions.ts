"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { markAllNotificationsRead } from "@/lib/notifications";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function markNotificationsRead() {
  await markAllNotificationsRead();
  revalidatePath("/", "layout");
}
