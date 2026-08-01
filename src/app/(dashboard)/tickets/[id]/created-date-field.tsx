"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CheckIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { setTicketCreatedAt } from "../actions";
import { useRole } from "@/lib/auth/role-context";

function toDateInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function CreatedDateField({
  ticketId,
  createdAt,
}: {
  ticketId: string;
  createdAt: Date;
}) {
  const role = useRole();
  const initial = toDateInputValue(createdAt);
  const [value, setValue] = useState(initial);
  const [pending, startTransition] = useTransition();
  const dirty = value !== initial;

  function handleSave() {
    startTransition(async () => {
      const result = await setTicketCreatedAt(ticketId, value);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Created date updated");
    });
  }

  if (role !== "admin") {
    return <span className="text-sm">{initial}</span>;
  }

  return (
    <div className="flex items-center gap-1.5">
      <Input
        type="date"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-7 w-36"
        disabled={pending}
      />
      {dirty && (
        <Button
          size="icon-sm"
          variant="outline"
          onClick={handleSave}
          disabled={pending}
          aria-label="Save created date"
        >
          <CheckIcon className="size-3.5" />
        </Button>
      )}
    </div>
  );
}
