"use client";

import { DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toCsv, downloadCsv } from "@/lib/csv";
import type { PeriodStats, DevMover } from "@/lib/period-comparison";

export function ExportSummaryButton({
  periodLabel,
  currentStats,
  previousStats,
  movers,
}: {
  periodLabel: string;
  currentStats: PeriodStats;
  previousStats: PeriodStats;
  movers: DevMover[];
}) {
  function handleExport() {
    const metricRows = [
      { metric: "Tickets Tested", current: currentStats.total, previous: previousStats.total },
      { metric: "Pass Rate %", current: currentStats.passRate, previous: previousStats.passRate },
      { metric: "Failed", current: currentStats.failed, previous: previousStats.failed },
      { metric: "Recurring", current: currentStats.recurring, previous: previousStats.recurring },
    ];

    const sections = [
      `Metrics (this period vs ${periodLabel})`,
      toCsv(metricRows, [
        { key: "metric", label: "Metric", value: (r) => r.metric },
        { key: "current", label: "Current", value: (r) => r.current },
        { key: "previous", label: "Previous", value: (r) => r.previous },
        { key: "delta", label: "Delta", value: (r) => r.current - r.previous },
      ]),
      "",
      "Dev Pass Rate Movers",
      toCsv(movers, [
        { key: "dev", label: "Dev", value: (m) => m.dev },
        { key: "previous_rate", label: "Previous Pass Rate %", value: (m) => m.previousRate },
        { key: "current_rate", label: "Current Pass Rate %", value: (m) => m.currentRate },
        { key: "delta", label: "Delta (pts)", value: (m) => m.delta },
      ]),
    ];

    downloadCsv(`summary-${new Date().toISOString().slice(0, 10)}.csv`, sections.join("\n"));
  }

  return (
    <Button variant="outline" size="sm" onClick={handleExport}>
      <DownloadIcon />
      Export CSV
    </Button>
  );
}
