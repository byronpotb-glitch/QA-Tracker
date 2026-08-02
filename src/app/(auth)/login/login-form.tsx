"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login, type LoginState } from "./actions";
import { plexMono } from "./fonts";

const initialState: LoginState = { error: null };

const labelClassName = `${plexMono.className} text-[10px] font-medium tracking-widest text-[#475467] uppercase`;
const inputClassName =
  "border-[#E4E7EC] focus-visible:border-[#2F6FEB] focus-visible:ring-[#2F6FEB]/20";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);

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
      <div className="flex flex-col gap-2">
        <Label htmlFor="password" className={labelClassName}>
          Password
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
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
        {pending ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  );
}
