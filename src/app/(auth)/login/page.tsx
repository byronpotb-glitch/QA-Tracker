import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "./login-form";
import { LoginStatusStrip } from "./login-status-strip";
import { plexSans, spaceGrotesk } from "./fonts";

export default function LoginPage() {
  return (
    <div
      className={`${plexSans.className} relative flex flex-1 items-center justify-center overflow-hidden bg-[#F7F8FA] p-4`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(#101828 1px, transparent 1px)",
          backgroundSize: "20px 20px",
          opacity: 0.05,
          maskImage:
            "radial-gradient(ellipse 60% 55% at 50% 40%, transparent 25%, black 85%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 60% 55% at 50% 40%, transparent 25%, black 85%)",
        }}
      />

      <div className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:duration-500 relative flex w-full max-w-sm flex-col items-center gap-6">
        <Image
          src="/logo.png"
          alt="QA Test Case Tracker"
          width={1254}
          height={1254}
          priority
          className="size-9"
        />

        <Card className="w-full gap-0 overflow-hidden rounded-xl border border-[#E4E7EC] p-0 py-0 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-8px_rgba(16,24,40,0.10)] ring-0">
          <LoginStatusStrip />

          <CardHeader className="px-4 pt-4">
            <CardTitle
              className={`${spaceGrotesk.className} text-center text-lg leading-tight font-semibold tracking-tight text-[#101828]`}
            >
              Quality Assurance Tester Tracker
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
