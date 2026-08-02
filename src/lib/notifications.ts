import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";

export async function notify(message: string, ticketId?: string): Promise<void> {
  await db.insert(notifications).values({ message, ticketId: ticketId ?? null });
}

export async function getRecentNotifications(limit = 20) {
  return db.query.notifications.findMany({
    orderBy: desc(notifications.createdAt),
    limit,
  });
}

export async function getUnreadNotificationCount(): Promise<number> {
  const rows = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(eq(notifications.read, false));
  return rows.length;
}

export async function markAllNotificationsRead(): Promise<void> {
  await db.update(notifications).set({ read: true }).where(eq(notifications.read, false));
}
