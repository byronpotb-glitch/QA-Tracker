import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/roles";
import { RoleProvider } from "@/lib/auth/role-context";
import { getRecentNotifications, getUnreadNotificationCount } from "@/lib/notifications";
import { AppSidebar } from "./app-sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const [notifications, unreadCount] = await Promise.all([
    getRecentNotifications(),
    getUnreadNotificationCount(),
  ]);

  return (
    <RoleProvider role={user.role}>
      <div className="flex flex-1">
        <AppSidebar notifications={notifications} unreadCount={unreadCount} />
        <main className="flex-1 overflow-y-auto bg-muted/30 p-4 sm:p-6">
          {children}
        </main>
      </div>
    </RoleProvider>
  );
}
