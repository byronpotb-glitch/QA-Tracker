"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

// recharts is a large client-only dependency — load it after the rest of
// the dashboard (stat tiles, table) is already interactive.
export const LazyStatusBarChart = dynamic(
  () => import("./status-bar-chart").then((mod) => mod.StatusBarChart),
  { ssr: false, loading: () => <Skeleton className="h-56 w-full" /> }
);
