import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DevPerformance } from "@/lib/dev-performance";

export function DevMiniList({
  title,
  icon: Icon,
  iconClassName,
  devs,
  metric,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  iconClassName: string;
  devs: DevPerformance[];
  metric: "passed" | "failed";
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
        {devs.length === 0 && (
          <p className="px-2 py-1.5 text-sm text-muted-foreground">
            No devs to show yet.
          </p>
        )}
        {devs.map((d) => (
          <Link
            key={d.dev}
            href={`/tickets?dev=${encodeURIComponent(d.dev)}`}
            className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted"
          >
            <span className="font-medium">{d.dev}</span>
            {metric === "passed" ? (
              <span className="text-green-600 dark:text-green-400">
                {d.passed} passed
              </span>
            ) : (
              <span className="text-muted-foreground">
                <span className="text-destructive">{d.failed} failed</span>
                {" · "}
                <span className="text-amber-600 dark:text-amber-400">
                  {d.recurring} recurring
                </span>
              </span>
            )}
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
