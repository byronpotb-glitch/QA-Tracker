"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteTicket } from "../actions";

export function DeleteTicketButton({
  ticketId,
  ticketTitle,
}: {
  ticketId: string;
  ticketTitle: string;
}) {
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm(`Delete ticket "${ticketTitle}"? This also deletes its test cases and cannot be undone.`)) {
      return;
    }
    startTransition(async () => {
      const result = await deleteTicket(ticketId);
      if (result?.error) toast.error(result.error);
    });
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Delete ticket"
      onClick={handleDelete}
      disabled={pending}
    >
      <Trash2Icon />
    </Button>
  );
}
