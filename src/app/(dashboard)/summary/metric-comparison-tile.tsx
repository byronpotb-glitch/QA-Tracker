import Link from "next/link";
import { ArrowUpIcon, ArrowDownIcon, MinusIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function MetricComparisonTile({
  label,
  icon: Icon,
  current,
  previous,
  unit = "count",
  higherIsBetter,
  periodLabel,
  href,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  current: number;
  previous: number;
  unit?: "count" | "percent";
  /** Whether an increase is an improvement (Tickets Tested) or a regression (Failed, Recurring). */
  higherIsBetter: boolean;
  periodLabel: string;
  href: string;
}) {
  const delta = current - previous;
  const direction = delta === 0 ? "flat" : delta > 0 ? "up" : "down";
  const isGood = delta === 0 ? null : higherIsBetter ? delta > 0 : delta < 0;

  const deltaText =
    unit === "percent"
      ? `${delta > 0 ? "+" : ""}${delta}pt${Math.abs(delta) === 1 ? "" : "s"}`
      : `${delta > 0 ? "+" : ""}${delta}`;

  const toneClasses =
    isGood === null
      ? "text-muted-foreground"
      : isGood
        ? "text-green-600 dark:text-green-400"
        : "text-destructive";

  return (
    <Link href={href} className="block h-full">
      <Card className="h-full transition-shadow hover:shadow-md hover:ring-foreground/20">
        <CardContent className="flex h-full flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{label}</span>
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground/70">
              <Icon className="size-4" />
            </div>
          </div>
          <span className="font-mono text-2xl font-semibold tabular-nums">
            {current.toLocaleString()}
            {unit === "percent" && "%"}
          </span>
          <div className={cn("flex items-center gap-1 text-xs font-medium", toneClasses)}>
            {direction === "up" && <ArrowUpIcon className="size-3" />}
            {direction === "down" && <ArrowDownIcon className="size-3" />}
            {direction === "flat" && <MinusIcon className="size-3" />}
            <span className="font-mono tabular-nums">{deltaText}</span>
            <span className="text-muted-foreground">vs {periodLabel}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
