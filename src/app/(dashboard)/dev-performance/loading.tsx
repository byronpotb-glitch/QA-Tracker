import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function DevPerformanceLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="flex flex-col gap-2 pt-6">
              {Array.from({ length: 2 }).map((_, j) => (
                <Skeleton key={j} className="h-8 w-full" />
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <Skeleton className="h-5 w-24" />
        <div className="rounded-xl ring-1 ring-foreground/10 p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="mb-3 h-8 w-full last:mb-0" />
          ))}
        </div>
      </div>
    </div>
  );
}
