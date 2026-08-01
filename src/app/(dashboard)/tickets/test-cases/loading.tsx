import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function TestCasesLoading() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-4 w-28" />

      <div>
        <Skeleton className="h-5 w-24" />
        <Skeleton className="mt-2 h-4 w-48" />
      </div>

      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-32" />
        ))}
      </div>

      <div className="flex flex-col gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent className="rounded-xl ring-1 ring-foreground/10 p-4">
              {Array.from({ length: 3 }).map((_, j) => (
                <Skeleton key={j} className="mb-3 h-7 w-full last:mb-0" />
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
