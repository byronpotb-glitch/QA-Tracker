"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import type { Company } from "@/lib/validations";

const COMPANIES: readonly Company[] = ["POTB", "GLADEX"];

export function DashboardCompanyFilter({ company }: { company?: Company }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setCompany(next: Company | undefined) {
    const params = new URLSearchParams(searchParams.toString());
    if (next) {
      params.set("company", next);
    } else {
      params.delete("company");
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div className="flex rounded-lg bg-muted p-0.5 text-sm">
      <button
        type="button"
        onClick={() => setCompany(undefined)}
        className={cn(
          "rounded-md px-3 py-1 font-medium transition-colors",
          !company
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        All
      </button>
      {COMPANIES.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => setCompany(c)}
          className={cn(
            "rounded-md px-3 py-1 font-medium transition-colors",
            company === c
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {c}
        </button>
      ))}
    </div>
  );
}
