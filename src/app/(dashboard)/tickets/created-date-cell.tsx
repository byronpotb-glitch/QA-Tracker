"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { PencilIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { setTicketCreatedAt } from "./actions";

const dateOnlyFormatter = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

function toDateInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function CreatedDateCell({
  ticketId,
  createdAt,
}: {
  ticketId: string;
  createdAt: Date;
}) {
  const initial = toDateInputValue(createdAt);
  const [value, setValue] = useState(initial);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      const result = await setTicketCreatedAt(ticketId, value);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Created date updated");
      setOpen(false);
    });
  }

  return (
    <div className="flex items-center gap-1">
      <span>{dateOnlyFormatter.format(createdAt)}</span>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) setValue(initial);
        }}
      >
        <PopoverTrigger
          render={
            <Button variant="ghost" size="icon-sm" aria-label="Edit created date">
              <PencilIcon />
            </Button>
          }
        />
        <PopoverContent className="w-auto">
          <PopoverHeader>
            <PopoverTitle>Edit created date</PopoverTitle>
          </PopoverHeader>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="h-8 w-40"
              disabled={pending}
            />
            <Button size="sm" onClick={handleSave} disabled={pending}>
              Save
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
