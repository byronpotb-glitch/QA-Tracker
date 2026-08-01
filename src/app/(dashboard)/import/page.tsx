import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/roles";
import { ImportPageClient } from "./import-client";

export default async function ImportPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    redirect("/dashboard");
  }

  return <ImportPageClient />;
}
