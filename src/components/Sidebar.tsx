"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function Sidebar({ planId, mode, doneSteps }: { planId: string; mode: "guided" | "advanced"; doneSteps: number[] }) {
  const path = usePathname();
  const base = `/plans/${planId}`;
  const groups = NAV.map((g) => ({ ...g, items: g.items.filter((i) => mode === "advanced" || i.step || i.tool) })).filter((g) => g.items.length);

  return (
    <nav className="flex h-full flex-col overflow-y-auto border-r border-sidebar-border bg-sidebar pb-6 pt-2 text-sidebar-foreground">
      {groups.map((g) => (
        <div key={g.group || "top"} className="mt-2.5">
          {g.group && <div className="px-4 pb-1 pt-1.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-sidebar-muted">{g.group}</div>}
          {g.items.map((it) => {
            const href = `${base}/${it.id}`;
            const active = path === href || path.startsWith(href + "/");
            const label = mode === "advanced" && it.advancedLabel ? it.advancedLabel : it.label;
            const done = it.step ? doneSteps.includes(it.step) : false;
            return (
              <Link key={it.id} href={href}
                className={cn("flex items-center gap-2.5 border-l-[3px] py-[7px] pl-[18px] pr-4 text-[13px] transition-colors hover:bg-sidebar-accent",
                  active ? "border-sidebar-primary bg-sidebar-accent text-sidebar-accent-foreground" : "border-transparent")}>
                {mode === "guided" && it.step ? (
                  <span className={cn("grid size-[18px] place-items-center rounded-full border text-[10px] font-bold",
                    active ? "border-sidebar-primary bg-sidebar-primary text-sidebar-primary-foreground" : done ? "border-good bg-good text-white" : "border-sidebar-border bg-sidebar-accent text-sidebar-muted")}>{it.step}</span>
                ) : (
                  <span className="w-[18px] text-center text-xs opacity-70">{it.id === "settings" ? "⚙" : it.tool ? "▦" : "▸"}</span>
                )}
                <span>{label}</span>
                {it.tag && <span className="ml-auto text-[10px] text-sidebar-muted">{it.tag}</span>}
              </Link>
            );
          })}
        </div>
      ))}
      <div className="mt-4 border-t border-sidebar-border px-4 pt-3.5 text-[11px] text-sidebar-muted">
        {mode === "guided" ? <><b className="text-sidebar-foreground">Guided path</b> — 12 steps, {doneSteps.length} done.</> : <><b className="text-sidebar-foreground">Advanced</b> — every module and assumption.</>}
      </div>
    </nav>
  );
}
