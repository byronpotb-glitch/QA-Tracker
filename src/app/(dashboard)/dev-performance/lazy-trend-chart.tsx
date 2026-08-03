"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

// recharts is a large client-only dependency — load it after the rest of
// the page (mini lists, table) is already interactive.
export const LazyTrendChart = dynamic(
  () => import("./trend-chart").then((mod) => mod.TrendChart),
  { ssr: false, loading: () => <Skeleton className="h-[260px] w-full" /> }
);
