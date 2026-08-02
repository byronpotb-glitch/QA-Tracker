"use client";

import { useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { PencilIcon } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { updateUserRole } from "./actions";
import type { Profile } from "@/db/schema";

const dateFormatter = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

export function UsersTable({
  users,
  currentUserId,
}: {
  users: Profile[];
  currentUserId: string;
}) {
  return (
    <div className="rounded-xl ring-1 ring-foreground/10">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="w-16">Edit</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => (
            <UserRow key={u.id} user={u} isSelf={u.id === currentUserId} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function UserRow({ user, isSelf }: { user: Profile; isSelf: boolean }) {
  const [pending, startTransition] = useTransition();

  function handleRoleChange(value: string | null) {
    if (!value || value === user.role) return;
    startTransition(async () => {
      const result = await updateUserRole(user.id, value as "admin" | "viewer");
      if (result.error) toast.error(result.error);
      else toast.success("Role updated");
    });
  }

  return (
    <TableRow>
      <TableCell className="font-medium">
        {user.email}
        {isSelf && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
      </TableCell>
      <TableCell>
        <Select value={user.role} onValueChange={handleRoleChange} disabled={pending}>
          <SelectTrigger size="sm" className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="viewer">Viewer</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="text-muted-foreground">
        {dateFormatter.format(user.createdAt)}
      </TableCell>
      <TableCell>
        {isSelf && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Edit your profile"
            nativeButton={false}
            render={<Link href="/profile" />}
          >
            <PencilIcon />
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}
