import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-zinc-50 p-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle at 12% 8%, rgba(99,102,241,0.14), transparent 42%), radial-gradient(circle at 92% 95%, rgba(99,102,241,0.10), transparent 45%)",
        }}
      />
      <div className="relative flex w-full max-w-sm flex-col items-center gap-6">
        <Image
          src="/logo.png"
          alt="QA Test Case Tracker"
          width={1254}
          height={1254}
          priority
          className="size-14"
        />
        <Card className="w-full rounded-2xl border-0 shadow-xl shadow-zinc-950/10 ring-0">
          <CardHeader>
            <CardTitle className="text-center">QA Test Case Tracker</CardTitle>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
