import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DevMover } from "@/lib/period-comparison";

export function DevMoversCard({
  title,
  icon: Icon,
  iconClassName,
  movers,
  emptyMessage,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  iconClassName: string;
  movers: DevMover[];
  emptyMessage: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Icon className={`size-4 ${iconClassName}`} />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {movers.length === 0 && (
          <p className="px-2 py-1.5 text-sm text-muted-foreground">{emptyMessage}</p>
        )}
        {movers.map((m) => (
          <Link
            key={m.dev}
            href={`/tickets?dev=${encodeURIComponent(m.dev)}`}
            className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted"
          >
            <span className="font-medium">{m.dev}</span>
            <span className="font-mono tabular-nums text-muted-foreground">
              {m.previousRate}% &rarr; {m.currentRate}%
              <span
                className={
                  m.delta >= 0
                    ? "ml-1.5 text-green-600 dark:text-green-400"
                    : "ml-1.5 text-destructive"
                }
              >
                ({m.delta > 0 ? "+" : ""}
                {m.delta}pt{Math.abs(m.delta) === 1 ? "" : "s"})
              </span>
            </span>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
