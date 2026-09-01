"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import type { Period } from "@/lib/period-comparison";

const PERIODS: { value: Period; label: string }[] = [
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
];

export function PeriodToggle({ period }: { period: Period }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setPeriod(next: Period) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", next);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex rounded-lg bg-muted p-0.5 text-sm">
      {PERIODS.map((p) => (
        <button
          key={p.value}
          type="button"
          onClick={() => setPeriod(p.value)}
          className={cn(
            "rounded-md px-3 py-1 font-medium transition-colors",
            period === p.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
