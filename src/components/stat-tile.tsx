import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";

export function StatTile({
  label,
  value,
  icon: Icon,
  percent,
  tone = "default",
  href,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  percent?: number;
  tone?: "default" | "critical" | "warning";
  href: string;
}) {
  const toneClasses = {
    default: {
      iconBg: "bg-muted text-foreground/70",
      bar: "bg-foreground/70",
    },
    critical: {
      iconBg: "bg-destructive/10 text-destructive",
      bar: "bg-destructive",
    },
    warning: {
      iconBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      bar: "bg-amber-500",
    },
  }[tone];

  return (
    <Link href={href} className="block h-full">
      <Card className="h-full transition-shadow hover:shadow-md hover:ring-foreground/20">
        <CardContent className="flex h-full flex-col justify-between gap-3">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{label}</span>
              <div
                className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${toneClasses.iconBg}`}
              >
                <Icon className="size-4" />
              </div>
            </div>
            <span className="font-mono text-2xl font-semibold tabular-nums">
              {value.toLocaleString()}
            </span>
          </div>
          {percent !== undefined && (
            <div className="flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full ${toneClasses.bar}`}
                  style={{ width: `${Math.min(100, percent)}%` }}
                />
              </div>
              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                {percent}%
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
