"use client";

import { DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toCsv, downloadCsv } from "@/lib/csv";

interface RecurringFailureRow {
  title: string;
  company: string;
  ticketStatus: string;
  failedCounter: number;
}

export function ExportRecurringButton({ rows }: { rows: RecurringFailureRow[] }) {
  function handleExport() {
    const csv = toCsv(rows, [
      { key: "title", label: "Title", value: (r) => r.title },
      { key: "company", label: "Company", value: (r) => r.company },
      { key: "ticketStatus", label: "Current Status", value: (r) => r.ticketStatus },
      { key: "failedCounter", label: "Times Failed", value: (r) => r.failedCounter },
    ]);
    downloadCsv(`recurring-failures-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }

  return (
    <Button variant="outline" size="sm" onClick={handleExport}>
      <DownloadIcon />
      Export CSV
    </Button>
  );
}
