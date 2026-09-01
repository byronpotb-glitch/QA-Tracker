"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type DateField = "created" | "updated";

function toDateOnly(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDate(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatLabel(from: string | undefined, to: string | undefined, field: DateField): string {
  if (!from || !to) return "All time";
  const fmt = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const fieldLabel = field === "updated" ? "Updated" : "Created";
  return `${fmt.format(parseDate(from))} – ${fmt.format(parseDate(to))} (${fieldLabel})`;
}

export function DashboardDateFilter({
  from,
  to,
  field,
}: {
  from?: string;
  to?: string;
  field: DateField;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [range, setRange] = useState<DateRange | undefined>(
    from && to ? { from: parseDate(from), to: parseDate(to) } : undefined
  );
  const [selectedField, setSelectedField] = useState<DateField>(field);
  const [hoverDate, setHoverDate] = useState<Date | undefined>(undefined);

  const previewRange: DateRange | undefined =
    range?.from && !range?.to && hoverDate
      ? range.from <= hoverDate
        ? { from: range.from, to: hoverDate }
        : { from: hoverDate, to: range.from }
      : range;

  function applyRange(newFrom?: Date, newTo?: Date, newField?: DateField) {
    const params = new URLSearchParams(searchParams.toString());
    if (newFrom && newTo) {
      params.set("from", toDateOnly(newFrom));
      params.set("to", toDateOnly(newTo));
      params.set("field", newField ?? selectedField);
    } else {
      params.delete("from");
      params.delete("to");
      params.delete("field");
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function applyMonthPreset(monthsAgo: number) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - monthsAgo + 1, 0);
    setRange({ from: start, to: end });
    applyRange(start, end);
  }

  /** Monday-to-Sunday, matching the weekly report cadence. */
  function applyWeekPreset(weeksAgo: number) {
    const now = new Date();
    const day = now.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday);
    start.setDate(start.getDate() - weeksAgo * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    setRange({ from: start, to: end });
    applyRange(start, end);
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm">
            <CalendarIcon />
            {formatLabel(from, to, field)}
          </Button>
        }
      />
      <PopoverContent className="w-auto">
        <PopoverHeader>
          <PopoverTitle>Filter by date</PopoverTitle>
        </PopoverHeader>

        <div className="flex rounded-lg bg-muted p-0.5 text-sm">
          {(["created", "updated"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setSelectedField(f)}
              className={cn(
                "flex-1 rounded-md px-2 py-1 font-medium capitalize transition-colors",
                selectedField === f
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Button variant="outline" size="sm" onClick={() => applyWeekPreset(0)}>
            This week
          </Button>
          <Button variant="outline" size="sm" onClick={() => applyWeekPreset(1)}>
            Last week
          </Button>
          <Button variant="outline" size="sm" onClick={() => applyMonthPreset(0)}>
            This month
          </Button>
          <Button variant="outline" size="sm" onClick={() => applyMonthPreset(1)}>
            Last month
          </Button>
        </div>
        <Calendar
          mode="range"
          numberOfMonths={1}
          selected={previewRange}
          onSelect={setRange}
          onDayMouseEnter={(date) => setHoverDate(date)}
          onDayMouseLeave={() => setHoverDate(undefined)}
        />
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setRange(undefined);
              applyRange(undefined, undefined);
            }}
          >
            Clear
          </Button>
          <Button
            size="sm"
            disabled={!range?.from || !range?.to}
            onClick={() => applyRange(range?.from, range?.to, selectedField)}
          >
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
