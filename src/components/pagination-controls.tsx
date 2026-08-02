import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PaginationControls({
  basePath,
  searchParams,
  page,
  pageSize,
  totalCount,
}: {
  basePath: string;
  searchParams: Record<string, string | undefined>;
  page: number;
  pageSize: number;
  totalCount: number;
}) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  if (totalPages <= 1) return null;

  function hrefFor(targetPage: number) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (value) params.set(key, value);
    }
    params.set("page", String(targetPage));
    return `${basePath}?${params.toString()}`;
  }

  return (
    <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
      <span>
        Page {page} of {totalPages} &middot; {totalCount} total
      </span>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={hrefFor(page - 1)} />}
          >
            <ChevronLeftIcon />
            Previous
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            <ChevronLeftIcon />
            Previous
          </Button>
        )}
        {page < totalPages ? (
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={hrefFor(page + 1)} />}
          >
            Next
            <ChevronRightIcon />
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            Next
            <ChevronRightIcon />
          </Button>
        )}
      </div>
    </div>
  );
}
