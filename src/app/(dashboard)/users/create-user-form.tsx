"use client";

import { useActionState, useState } from "react";
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
import { createUserAccount, type ActionResult } from "./actions";

const initialState: ActionResult = { error: null };

export function CreateUserForm() {
  const [state, formAction, pending] = useActionState(createUserAccount, initialState);
  const [role, setRole] = useState<"admin" | "viewer">("viewer");

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="role" value={role} />
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Temporary password</Label>
          <Input id="password" name="password" type="text" minLength={8} required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="role-select">Role</Label>
          <Select
            value={role}
            onValueChange={(value) => value && setRole(value as "admin" | "viewer")}
          >
            <SelectTrigger id="role-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="viewer">Viewer</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Creating..." : "Create user"}
      </Button>
    </form>
  );
}
