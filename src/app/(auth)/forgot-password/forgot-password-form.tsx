"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordReset, type ForgotPasswordState } from "./actions";
import { plexMono } from "../login/fonts";

const initialState: ForgotPasswordState = { error: null, success: false };

const labelClassName = `${plexMono.className} text-[10px] font-medium tracking-widest text-[#475467] uppercase`;
const inputClassName =
  "border-[#E4E7EC] bg-white text-[#101828] dark:bg-white focus-visible:border-[#2F6FEB] focus-visible:ring-[#2F6FEB]/20";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(
    requestPasswordReset,
    initialState
  );

  if (state.success) {
    return (
      <div className="flex flex-col gap-4 text-sm">
        <p className="text-[#101828]">
          If an account exists for that email, we&apos;ve sent a link to reset
          your password.
        </p>
        <Link
          href="/login"
          className="text-[#2F6FEB] hover:underline"
        >
          Back to login
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email" className={labelClassName}>
          Email
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
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
        {pending ? "Sending..." : "Send reset link"}
      </Button>
      <Link
        href="/login"
        className="text-center text-xs text-[#475467] hover:text-[#2F6FEB] hover:underline"
      >
        Back to login
      </Link>
    </form>
  );
}
