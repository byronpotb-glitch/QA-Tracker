import Image from "next/image";
import { plexSans } from "./login/fonts";

export function AuthShell({ children }: { children: React.ReactNode }) {
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
        <div className="flex items-center gap-2.5">
          <Image
            src="/logo.png"
            alt="QA Test Case Tracker"
            width={1254}
            height={1254}
            priority
            className="size-8"
          />
          <span
            className={`${plexSans.className} text-lg leading-tight font-semibold tracking-tight text-[#101828]`}
          >
            Quality Assurance Tester Tracker
          </span>
        </div>

        {children}
      </div>
    </div>
  );
}
