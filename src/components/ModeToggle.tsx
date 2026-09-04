"use client";

import { useTransition } from "react";
import { usePathname } from "next/navigation";
import { setMode } from "@/app/(app)/actions";

export function ModeToggle({ mode }: { mode: "guided" | "advanced" }) {
  const [pending, start] = useTransition();
  const path = usePathname();
  const btn = (m: "guided" | "advanced", label: string) => (
    <button
      type="button"
      onClick={() => start(() => setMode(m, path))}
      disabled={pending}
      className={`rounded-full px-3.5 py-1 text-xs font-semibold transition ${mode === m ? "bg-primary text-white" : "text-nav-muted hover:text-nav-text"}`}
      aria-pressed={mode === m}
    >
      {label}
    </button>
  );
  return (
    <div className="flex rounded-full border border-nav-line bg-nav-active p-0.5" role="group" aria-label="Interface mode">
      {btn("guided", "Guided")}
      {btn("advanced", "Advanced")}
    </div>
  );
}
