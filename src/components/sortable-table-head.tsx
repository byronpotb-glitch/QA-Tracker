import Link from "next/link";
import { ArrowUpIcon, ArrowDownIcon } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { SortDir } from "@/lib/sort-link";

export function SortableTableHead({
  label,
  href,
  active,
  dir,
  align,
  className,
}: {
  label: string;
  href: string;
  active: boolean;
  dir: SortDir;
  align?: "right";
  className?: string;
}) {
  return (
    <TableHead className={cn(align === "right" && "text-right", className)}>
      <Link
        href={href}
        className={cn(
          "inline-flex items-center gap-1 hover:text-foreground",
          align === "right" && "flex-row-reverse",
          !active && "text-muted-foreground"
        )}
      >
        {label}
        {active &&
          (dir === "asc" ? (
            <ArrowUpIcon className="size-3" />
          ) : (
            <ArrowDownIcon className="size-3" />
          ))}
      </Link>
    </TableHead>
  );
}
