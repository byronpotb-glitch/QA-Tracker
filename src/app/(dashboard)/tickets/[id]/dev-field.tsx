"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CheckIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { setTicketDev } from "../actions";

export function DevField({
  ticketId,
  dev,
}: {
  ticketId: string;
  dev: string | null;
}) {
  const [value, setValue] = useState(dev ?? "");
  const [pending, startTransition] = useTransition();
  const dirty = value.trim() !== (dev ?? "");

  function handleSave() {
    startTransition(async () => {
      const result = await setTicketDev(ticketId, value);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Dev updated");
    });
  }

  return (
    <div className="flex items-center gap-1.5">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Unassigned"
        className="h-7 w-32"
        disabled={pending}
      />
      {dirty && (
        <Button
          size="icon-sm"
          variant="outline"
          onClick={handleSave}
          disabled={pending}
          aria-label="Save dev"
        >
          <CheckIcon className="size-3.5" />
        </Button>
      )}
    </div>
  );
}
