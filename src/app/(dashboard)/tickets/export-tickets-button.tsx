"use client";

import { useState } from "react";
import { toast } from "sonner";
import { DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadCsv } from "@/lib/csv";
import { exportTicketsCsv } from "./export-actions";
import type { TicketFilterParams } from "@/lib/build-ticket-filters";

export function ExportTicketsButton({ params }: { params: TicketFilterParams }) {
  const [pending, setPending] = useState(false);

  async function handleExport() {
    setPending(true);
    try {
      const { csv } = await exportTicketsCsv(params);
      downloadCsv(`tickets-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    } catch {
      toast.error("Could not export tickets.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={pending}>
      <DownloadIcon />
      {pending ? "Exporting..." : "Export CSV"}
    </Button>
  );
}
