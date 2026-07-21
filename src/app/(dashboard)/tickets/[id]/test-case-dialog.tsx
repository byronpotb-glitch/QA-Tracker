"use client";

import { useState, useTransition, type ReactElement } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addTestCase, updateTestCase } from "../actions";
import type { TestCase } from "@/db/schema";

const PRIORITIES = ["HIGH", "MEDIUM", "LOW"] as const;
const STATUSES = [
  "NOT_TESTED",
  "IN_PROGRESS",
  "PASSED",
  "FAILED",
  "ON_HOLD",
  "PENDING",
] as const;

export function TestCaseDialog({
  ticketId,
  testCase,
  trigger,
}: {
  ticketId: string;
  testCase?: TestCase;
  trigger: ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isEdit = Boolean(testCase);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = isEdit
        ? await updateTestCase(ticketId, testCase!.id, formData)
        : await addTestCase(ticketId, formData);

      if (result.error) {
        setError(result.error);
        return;
      }
      toast.success(isEdit ? "Test case updated" : "Test case added");
      setOpen(false);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setError(null);
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Test Case" : "Add Test Case"}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={handleSubmit}
          className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto pr-1"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="tc_number">TC Number</Label>
              <Input
                id="tc_number"
                name="tc_number"
                defaultValue={testCase?.tcNumber}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="page">Page</Label>
              <Input id="page" name="page" defaultValue={testCase?.page} required />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={testCase?.description}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="priority">Priority</Label>
              <Select name="priority" defaultValue={testCase?.priority ?? "MEDIUM"}>
                <SelectTrigger id="priority" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="status">Status</Label>
              <Select name="status" defaultValue={testCase?.status ?? "NOT_TESTED"}>
                <SelectTrigger id="status" className="w-full">
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
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="expected_result">Expected Result</Label>
            <Textarea
              id="expected_result"
              name="expected_result"
              defaultValue={testCase?.expectedResult}
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="actual_result">Actual Result</Label>
            <Textarea
              id="actual_result"
              name="actual_result"
              defaultValue={testCase?.actualResult ?? ""}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="comments">Comments</Label>
            <Textarea
              id="comments"
              name="comments"
              defaultValue={testCase?.comments ?? ""}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="tested_date">Tested Date</Label>
            <Input
              id="tested_date"
              name="tested_date"
              type="date"
              defaultValue={testCase?.testedDate ?? ""}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : isEdit ? "Save Changes" : "Add Test Case"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
