import Link from "next/link";
import { Button } from "@/components/ui/button";
import { signOut } from "./actions";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b">
        <div className="flex items-center justify-between px-4 py-3 sm:px-6">
          <nav className="flex items-center gap-4 text-sm font-medium">
            <Link href="/tickets" className="hover:underline">
              Tickets
            </Link>
            <Link href="/import" className="hover:underline">
              Import
            </Link>
          </nav>
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </header>
      <main className="flex flex-1 flex-col p-4 sm:p-6">{children}</main>
    </div>
  );
}
