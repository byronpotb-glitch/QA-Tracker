import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AuthShell } from "../auth-shell";
import { ResetPasswordForm } from "./reset-password-form";
import { plexMono } from "../login/fonts";

export default function ResetPasswordPage() {
  return (
    <AuthShell>
      <Card className="w-full gap-0 overflow-hidden rounded-xl border border-[#E4E7EC] bg-white p-0 py-0 text-[#101828] shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-8px_rgba(16,24,40,0.10)] ring-0">
        <CardHeader className="px-4 pt-4">
          <CardTitle
            className={`${plexMono.className} text-base leading-tight font-semibold tracking-tight text-[#101828]`}
          >
            Set a new password
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pt-2 pb-4">
          <ResetPasswordForm />
        </CardContent>
      </Card>
    </AuthShell>
  );
}
