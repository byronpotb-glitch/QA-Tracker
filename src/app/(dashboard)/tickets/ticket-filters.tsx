"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

const COMPANIES = ["POTB", "GLADEX"] as const;
const STATUSES = ["PASSED", "FAILED", "IN_PROGRESS", "PENDING", "ON_HOLD"] as const;

export function TicketFilters({
  company,
  status,
}: {
  company?: string;
  status?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

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

  const hasFilters = Boolean(company || status);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={company ?? "ALL"}
        onValueChange={(value) => setParam("company", value === "ALL" ? null : value)}
      >
        <SelectTrigger className="w-40">
          <SelectValue placeholder="All companies" />
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
      <Select
        value={status ?? "ALL"}
        onValueChange={(value) => setParam("status", value === "ALL" ? null : value)}
      >
        <SelectTrigger className="w-40">
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All statuses</SelectItem>
          {STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {s.replace("_", " ")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={() => router.push(pathname)}>
          Clear filters
        </Button>
      )}
    </div>
  );
}
