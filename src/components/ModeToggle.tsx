"use client";

import { useMode, type Mode } from "@/components/ModeProvider";
import { cn } from "@/lib/utils";

export function ModeToggle() {
  const { mode, setMode } = useMode();
  const btn = (m: Mode, label: string) => (
    <button
      type="button" onClick={() => setMode(m)} aria-pressed={mode === m}
      className={cn("rounded-full px-3.5 py-1 text-xs font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-sidebar-ring/50",
        mode === m ? "bg-sidebar-primary text-sidebar-primary-foreground" : "text-sidebar-muted hover:text-sidebar-foreground")}
    >{label}</button>
  );
  return (
    <div className="flex rounded-full border border-sidebar-border bg-sidebar-accent p-0.5" role="group" aria-label="Interface mode">
      {btn("guided", "Guided")}{btn("advanced", "Advanced")}
    </div>
  );
}
