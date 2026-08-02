"use client";

import { useTransition } from "react";
import Link from "next/link";
import { BellIcon } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { markNotificationsRead } from "@/app/(dashboard)/actions";
import type { Notification } from "@/db/schema";

const relativeFormatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

function relativeTime(date: Date): string {
  const diffMs = date.getTime() - Date.now();
  const diffMin = Math.round(diffMs / 60000);
  if (Math.abs(diffMin) < 60) return relativeFormatter.format(diffMin, "minute");
  const diffHour = Math.round(diffMin / 60);
  if (Math.abs(diffHour) < 24) return relativeFormatter.format(diffHour, "hour");
  const diffDay = Math.round(diffHour / 24);
  return relativeFormatter.format(diffDay, "day");
}

export function NotificationsBell({
  notifications,
  unreadCount,
}: {
  notifications: Notification[];
  unreadCount: number;
}) {
  const [pending, startTransition] = useTransition();

  function handleMarkRead() {
    startTransition(async () => {
      await markNotificationsRead();
    });
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label="Notifications"
            className="relative flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
          >
            <BellIcon className="size-4" />
            Notifications
            {unreadCount > 0 && (
              <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-indigo-500 text-[10px] font-semibold text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
        }
      />
      <PopoverContent align="start" side="right" className="w-80">
        <PopoverHeader className="flex items-center justify-between">
          <PopoverTitle>Activity</PopoverTitle>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkRead}
              disabled={pending}
              className="h-7 px-2 text-xs"
            >
              Mark all read
            </Button>
          )}
        </PopoverHeader>
        <div className="flex max-h-80 flex-col gap-1 overflow-y-auto">
          {notifications.length === 0 && (
            <p className="px-1 py-4 text-center text-sm text-muted-foreground">
              No activity yet.
            </p>
          )}
          {notifications.map((n) => (
            <Link
              key={n.id}
              href={n.ticketId ? `/tickets/${n.ticketId}` : "/tickets"}
              className={cn(
                "flex flex-col gap-0.5 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted",
                !n.read && "bg-muted/60"
              )}
            >
              <span>{n.message}</span>
              <span className="text-xs text-muted-foreground">
                {relativeTime(n.createdAt)}
              </span>
            </Link>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
