"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SearchIcon, SlidersHorizontalIcon } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";

const COMPANIES = ["POTB", "GLADEX"] as const;
const STATUSES = ["PASSED", "FAILED", "IN_PROGRESS", "PENDING", "ON_HOLD"] as const;
const ISSUE_TYPES = ["BUG", "FEATURE", "IMPROVEMENT", "CHANGE_REQUEST"] as const;

function formatLabel(value: string): string {
  return value.replace(/_/g, " ");
}

export function TicketFilters({
  q,
  company,
  status,
  system,
  issueType,
  dev,
  systems,
  devs,
}: {
  q?: string;
  company?: string;
  status?: string;
  system?: string;
  issueType?: string;
  dev?: string;
  systems: string[];
  devs: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [searchValue, setSearchValue] = useState(q ?? "");

  useEffect(() => {
    setSearchValue(q ?? "");
  }, [q]);

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  useEffect(() => {
    const trimmed = searchValue.trim();
    if (trimmed === (q ?? "")) return;
    const timeout = setTimeout(() => {
      setParam("q", trimmed || null);
    }, 400);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchValue]);

  const hasAdvancedFilters = Boolean(system || issueType || dev);
  const hasFilters = Boolean(q || company || status || hasAdvancedFilters);

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">Search</Label>
        <div className="relative w-56">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Search titles..."
            className="pl-8"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">Company</Label>
        <Select
          value={company ?? "ALL"}
          onValueChange={(value) => setParam("company", value === "ALL" ? null : value)}
        >
          <SelectTrigger className="w-40">
            <SelectValue>
              {(value: string) => (value === "ALL" ? "All companies" : value)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All companies</SelectItem>
            {COMPANIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">Status</Label>
        <Select
          value={status ?? "ALL"}
          onValueChange={(value) => setParam("status", value === "ALL" ? null : value)}
        >
          <SelectTrigger className="w-40">
            <SelectValue>
              {(value: string) => (value === "ALL" ? "All statuses" : formatLabel(value))}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {formatLabel(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Popover>
        <PopoverTrigger
          render={
            <Button variant="outline" className="relative gap-1.5">
              <SlidersHorizontalIcon className="size-4" />
              More filters
              {hasAdvancedFilters && (
                <span className="absolute -top-1 -right-1 size-2 rounded-full bg-primary" />
              )}
            </Button>
          }
        />
        <PopoverContent className="w-72">
          <PopoverHeader>
            <PopoverTitle>Advanced filters</PopoverTitle>
          </PopoverHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">System</Label>
              <Select
                value={system ?? "ALL"}
                onValueChange={(value) => setParam("system", value === "ALL" ? null : value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(value: string) => (value === "ALL" ? "All systems" : value)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All systems</SelectItem>
                  {systems.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Issue Type</Label>
              <Select
                value={issueType ?? "ALL"}
                onValueChange={(value) => setParam("issue_type", value === "ALL" ? null : value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(value: string) => (value === "ALL" ? "All issue types" : formatLabel(value))}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All issue types</SelectItem>
                  {ISSUE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {formatLabel(t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Dev</Label>
              <Select
                value={dev ?? "ALL"}
                onValueChange={(value) => setParam("dev", value === "ALL" ? null : value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(value: string) => (value === "ALL" ? "All devs" : value)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All devs</SelectItem>
                  {devs.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={() => router.push(pathname)}>
          Clear filters
        </Button>
      )}
    </div>
  );
}
