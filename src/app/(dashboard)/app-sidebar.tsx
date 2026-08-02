"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboardIcon,
  TicketIcon,
  UploadIcon,
  UsersIcon,
  UserCogIcon,
  LogOutIcon,
  ChevronDownIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { signOut } from "./actions";
import { useRole } from "@/lib/auth/role-context";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: { href: string; label: string }[];
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboardIcon },
  {
    href: "/tickets",
    label: "Tickets",
    icon: TicketIcon,
    children: [{ href: "/tickets/test-cases", label: "Test Cases" }],
  },
  { href: "/import", label: "Import", icon: UploadIcon, adminOnly: true },
  { href: "/dev-performance", label: "Dev Performance", icon: UsersIcon },
  { href: "/users", label: "Users", icon: UserCogIcon, adminOnly: true },
];

export function AppSidebar() {
  const pathname = usePathname();
  const role = useRole();
  const visibleItems = NAV_ITEMS.filter((item) => !item.adminOnly || role === "admin");
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(visibleItems.filter((item) => item.children).map((item) => [item.href, true]))
  );

  return (
    <aside className="flex w-60 shrink-0 flex-col gap-6 overflow-y-auto bg-zinc-950 p-4">
      <div className="flex items-center gap-2 px-2 py-1">
        <Image
          src="/logo.png"
          alt="QA Tracker"
          width={1254}
          height={1254}
          className="size-8 shrink-0 rounded-lg"
        />
        <span className="text-sm font-semibold text-zinc-100">
          QA Tracker
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {visibleItems.map((item) => {
          const childActive =
            item.children?.some((child) => pathname.startsWith(child.href)) ?? false;
          const active = !childActive && pathname.startsWith(item.href);
          const Icon = item.icon;

          const isOpen = openGroups[item.href] ?? true;

          return (
            <div key={item.href} className="flex flex-col gap-1">
              <div className="flex items-center gap-1">
                <Link
                  href={item.href}
                  className={cn(
                    "flex flex-1 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-indigo-500 text-white shadow-sm shadow-indigo-950/40"
                      : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
                {item.children && (
                  <button
                    type="button"
                    onClick={() =>
                      setOpenGroups((prev) => ({ ...prev, [item.href]: !isOpen }))
                    }
                    aria-label={isOpen ? `Collapse ${item.label}` : `Expand ${item.label}`}
                    aria-expanded={isOpen}
                    className="flex size-8 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
                  >
                    <ChevronDownIcon
                      className={cn("size-4 transition-transform", !isOpen && "-rotate-90")}
                    />
                  </button>
                )}
              </div>

              {item.children && isOpen && (
                <div className="flex flex-col gap-1 pl-6">
                  {item.children.map((child) => {
                    const childIsActive = pathname.startsWith(child.href);
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={cn(
                          "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                          childIsActive
                            ? "bg-indigo-500/15 text-indigo-300"
                            : "text-zinc-500 hover:bg-zinc-900 hover:text-zinc-100"
                        )}
                      >
                        {child.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
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
