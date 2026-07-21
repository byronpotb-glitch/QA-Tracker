"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createTicket, type CreateTicketState } from "../actions";

const initialState: CreateTicketState = { error: null };

const ISSUE_TYPES = [
  "BUG",
  "BUG_FIX",
  "FEATURE",
  "IMPROVEMENT",
  "CHANGE_REQUEST",
] as const;

export function NewTicketForm() {
  const [state, formAction, pending] = useActionState(
    createTicket,
    initialState
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" required />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="company">Company</Label>
          <Select name="company" defaultValue="POTB">
            <SelectTrigger id="company" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="POTB">POTB</SelectItem>
              <SelectItem value="GLADEX">GLADEX</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="issue_type">Issue Type</Label>
          <Select name="issue_type" defaultValue="BUG">
            <SelectTrigger id="issue_type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ISSUE_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="system">System</Label>
          <Input id="system" name="system" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="module">Module</Label>
          <Input id="module" name="module" required />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="tester">Tester</Label>
        <Input id="tester" name="tester" required />
      </div>

      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Creating..." : "Create Ticket"}
      </Button>
    </form>
  );
}
