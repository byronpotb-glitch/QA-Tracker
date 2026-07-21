import { AppSidebar } from "./app-sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1">
      <AppSidebar />
      <main className="flex-1 overflow-y-auto bg-muted/30 p-4 sm:p-6">
        {children}
      </main>
    </div>
  );
}
