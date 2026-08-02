import { Card, CardContent } from "@/components/ui/card";
import { AuthShell } from "../auth-shell";
import { LoginForm } from "./login-form";
import { LoginStatusStrip } from "./login-status-strip";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <AuthShell>
      <Card className="w-full gap-0 overflow-hidden rounded-xl border border-[#E4E7EC] bg-white p-0 py-0 text-[#101828] shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-8px_rgba(16,24,40,0.10)] ring-0">
        <LoginStatusStrip />

        <CardContent className="flex flex-col gap-3 px-4 pt-4 pb-4">
          {params.error === "reset-link-invalid" && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              That reset link has expired or already been used. Request a new
              one from the login form below.
            </p>
          )}
          <LoginForm />
        </CardContent>
      </Card>
    </AuthShell>
  );
}
