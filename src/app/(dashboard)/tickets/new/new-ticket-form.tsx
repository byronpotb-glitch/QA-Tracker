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
import type { ProjectRow } from "@/db/schema";

const initialState: CreateTicketState = { error: null };

const COMPANIES = ["POTB", "GLADEX"] as const;
const ISSUE_TYPES = ["BUG", "FEATURE", "IMPROVEMENT", "CHANGE_REQUEST"] as const;

export function NewTicketForm({ projects }: { projects: ProjectRow[] }) {
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
              {COMPANIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
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
          <Select name="system" defaultValue={projects[0]?.name}>
            <SelectTrigger id="system" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.name}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
