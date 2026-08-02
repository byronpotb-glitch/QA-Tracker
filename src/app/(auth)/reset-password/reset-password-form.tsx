"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updatePassword, type ResetPasswordState } from "./actions";
import { plexMono } from "../login/fonts";

const initialState: ResetPasswordState = { error: null };

const labelClassName = `${plexMono.className} text-[10px] font-medium tracking-widest text-[#475467] uppercase`;
const inputClassName =
  "border-[#E4E7EC] bg-white text-[#101828] dark:bg-white focus-visible:border-[#2F6FEB] focus-visible:ring-[#2F6FEB]/20";

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(updatePassword, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="password" className={labelClassName}>
          New password
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className={inputClassName}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="confirm_password" className={labelClassName}>
          Confirm password
        </Label>
        <Input
          id="confirm_password"
          name="confirm_password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className={inputClassName}
        />
      </div>
      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      <Button
        type="submit"
        disabled={pending}
        className="bg-[#2F6FEB] text-white hover:bg-[#2557C7]"
      >
        {pending ? "Updating..." : "Update password"}
      </Button>
    </form>
  );
}
