"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login, type LoginState } from "./actions";
import { plexMono } from "./fonts";

const initialState: LoginState = { error: null };

const labelClassName = `${plexMono.className} text-[10px] font-medium tracking-widest text-[#475467] uppercase`;
const inputClassName =
  "border-[#E4E7EC] bg-white text-[#101828] dark:bg-white focus-visible:border-[#2F6FEB] focus-visible:ring-[#2F6FEB]/20";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);
  const [showPassword, setShowPassword] = useState(false);

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
        <div className="flex items-center justify-between">
          <Label htmlFor="password" className={labelClassName}>
            Password
          </Label>
          <Link
            href="/forgot-password"
            className="text-xs text-[#475467] hover:text-[#2F6FEB] hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            className={`${inputClassName} pr-9`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute top-1/2 right-2.5 -translate-y-1/2 text-[#475467] hover:text-[#2F6FEB]"
          >
            {showPassword ? (
              <EyeOffIcon className="size-4" />
            ) : (
              <EyeIcon className="size-4" />
            )}
          </button>
        </div>
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
