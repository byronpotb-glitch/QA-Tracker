"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboardIcon,
  TicketIcon,
  UploadIcon,
  UsersIcon,
  LogOutIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { signOut } from "./actions";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboardIcon },
  { href: "/tickets", label: "Tickets", icon: TicketIcon },
  { href: "/import", label: "Import", icon: UploadIcon },
  { href: "/dev-performance", label: "Dev Performance", icon: UsersIcon },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-60 shrink-0 flex-col gap-6 bg-zinc-950 p-4">
      <div className="flex items-center gap-2 px-2 py-1">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-xs font-bold text-zinc-950">
          QA
        </div>
        <span className="text-sm font-semibold text-zinc-100">
          QA Tracker
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-zinc-100 text-zinc-950"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <form action={signOut}>
        <button
          type="submit"
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
        >
          <LogOutIcon className="size-4" />
          Sign out
        </button>
      </form>
    </aside>
  );
}
