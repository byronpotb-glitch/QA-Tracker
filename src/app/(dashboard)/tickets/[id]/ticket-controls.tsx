"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/lib/status";
import { setTicketStatus, toggleManualOverride } from "../actions";
import type { TicketStatus } from "@/lib/validations";

const STATUSES: readonly TicketStatus[] = [
  "PASSED",
  "FAILED",
  "IN_PROGRESS",
  "PENDING",
  "ON_HOLD",
];

export function TicketControls({
  ticketId,
  status,
  manualOverride,
}: {
  ticketId: string;
  status: TicketStatus;
  manualOverride: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      const result = await toggleManualOverride(ticketId, !manualOverride);
      if (result.error) toast.error(result.error);
    });
  }

  function handleStatusChange(value: string | null) {
    if (!value) return;
    startTransition(async () => {
      const result = await setTicketStatus(ticketId, value as TicketStatus);
      if (result.error) toast.error(result.error);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {manualOverride ? (
        <Select value={status} onValueChange={handleStatusChange} disabled={pending}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <StatusBadge status={status} className="h-7 px-3 text-sm" />
      )}
      <Button
        variant={manualOverride ? "secondary" : "outline"}
        size="sm"
        onClick={handleToggle}
        disabled={pending}
      >
        {manualOverride ? "Manual override: ON" : "Manual override: OFF"}
      </Button>
      {!manualOverride && (
        <p className="text-xs text-muted-foreground">
          Status is computed automatically from test cases.
        </p>
      )}
    </div>
  );
}
