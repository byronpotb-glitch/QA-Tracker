import { Skeleton } from "@/components/ui/skeleton";

export default function TicketsLoading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-semibold">Tickets</h1>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-32" />
        ))}
      </div>

      <div className="rounded-xl ring-1 ring-foreground/10 p-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="mb-3 h-8 w-full last:mb-0" />
        ))}
      </div>
    </div>
  );
}
