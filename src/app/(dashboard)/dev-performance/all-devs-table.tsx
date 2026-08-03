"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpIcon,
  ArrowDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  SearchIcon,
  DownloadIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { passRate, type DevPerformance } from "@/lib/dev-performance";
import { toCsv, downloadCsv } from "@/lib/csv";

type SortKey = "dev" | "total" | "passed" | "failed" | "recurring" | "passRate";

const PAGE_SIZES = [5, 10, 20, 50] as const;

const COLUMNS: { key: SortKey; label: string; align?: "right" }[] = [
  { key: "dev", label: "Dev" },
  { key: "total", label: "Total", align: "right" },
  { key: "passed", label: "Passed", align: "right" },
  { key: "failed", label: "Failed", align: "right" },
  { key: "recurring", label: "Recurring", align: "right" },
  { key: "passRate", label: "Pass Rate", align: "right" },
];

export function AllDevsTable({ devs }: { devs: DevPerformance[] }) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("total");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);

  const withRate = useMemo(
    () => devs.map((d) => ({ ...d, passRate: passRate(d) })),
    [devs]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? withRate.filter((d) => d.dev.toLowerCase().includes(q)) : withRate;
  }, [withRate, search]);

  const sorted = useMemo(() => {
    const rows = [...filtered];
    rows.sort((a, b) => {
      if (sortKey === "dev") {
        const diff = a.dev.localeCompare(b.dev);
        return sortDir === "asc" ? diff : -diff;
      }
      const diff = a[sortKey] - b[sortKey];
      return sortDir === "asc" ? diff : -diff;
    });
    return rows;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "dev" ? "asc" : "desc");
    }
    setPage(1);
  }

  function handleExport() {
    const csv = toCsv(sorted, [
      { key: "dev", label: "Dev", value: (d) => d.dev },
      { key: "total", label: "Total", value: (d) => d.total },
      { key: "passed", label: "Passed", value: (d) => d.passed },
      { key: "failed", label: "Failed", value: (d) => d.failed },
      { key: "recurring", label: "Recurring", value: (d) => d.recurring },
      { key: "passRate", label: "Pass Rate %", value: (d) => d.passRate },
    ]);
    downloadCsv(`dev-performance-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-56">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search dev..."
            className="pl-8"
          />
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <DownloadIcon />
            Export CSV
          </Button>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Show</span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => {
                if (!v) return;
                setPageSize(Number(v));
                setPage(1);
              }}
            >
              <SelectTrigger className="w-16">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span>per page</span>
          </div>
        </div>
      </div>

      <div className="rounded-xl ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              {COLUMNS.map((col) => (
                <TableHead key={col.key} className={col.align === "right" ? "text-right" : undefined}>
                  <button
                    type="button"
                    onClick={() => toggleSort(col.key)}
                    className={cn(
                      "inline-flex items-center gap-1 hover:text-foreground",
                      col.align === "right" && "flex-row-reverse"
                    )}
                  >
                    {col.label}
                    {sortKey === col.key &&
                      (sortDir === "asc" ? (
                        <ArrowUpIcon className="size-3" />
                      ) : (
                        <ArrowDownIcon className="size-3" />
                      ))}
                  </button>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.length === 0 && (
              <TableRow>
                <TableCell colSpan={COLUMNS.length} className="py-8 text-center text-muted-foreground">
                  No devs match &quot;{search}&quot;.
                </TableCell>
              </TableRow>
            )}
            {paged.map((d) => {
              const base = `/tickets?dev=${encodeURIComponent(d.dev)}`;
              return (
                <TableRow key={d.dev}>
                  <TableCell className="font-medium">
                    <Link href={base} className="hover:underline">
                      {d.dev}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={base} className="hover:underline">
                      {d.total}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right text-green-600 dark:text-green-400">
                    <Link href={`${base}&status=PASSED`} className="hover:underline">
                      {d.passed}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right text-destructive">
                    <Link href={`${base}&status=FAILED`} className="hover:underline">
                      {d.failed}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right text-amber-600 dark:text-amber-400">
                    <Link href={`${base}&recurring=1`} className="hover:underline">
                      {d.recurring}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                    {d.passRate}%
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {currentPage} of {totalPages} &middot; {sorted.length} dev
            {sorted.length === 1 ? "" : "s"}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeftIcon />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
              <ChevronRightIcon />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
