"use client";

import { useEffect, useState } from "react";
import { StatusBadge } from "@/lib/status";
import { plexMono } from "./fonts";

export function LoginStatusStrip() {
  const [status, setStatus] = useState<"PENDING" | "PASSED">("PENDING");

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setStatus("PASSED");
      return;
    }
    const timer = setTimeout(() => setStatus("PASSED"), 650);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex items-center justify-between rounded-t-xl border-b border-[#E4E7EC] bg-[#F7F8FA] px-4 py-2.5">
      <span
        className={`${plexMono.className} text-[10px] font-medium tracking-widest text-[#475467] uppercase`}
      >
        TC-000 &middot; Login
      </span>
      <StatusBadge
        status={status}
        className={`${plexMono.className} text-[10px] transition-colors duration-300`}
      />
    </div>
  );
}
