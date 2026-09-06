"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The one layout for a data module (SaaS §6.11, mockup docs/mockup/record-pattern.html):
 *
 *   module bar   — pinned directly under the top bar; one item per DATA AREA of the module selected in the left nav;
 *                  a scope chip on the right ("All people" / one person)
 *   page header  — step eyebrow, title, subtitle, Help toggle, primary action; thin progress line
 *   body         — the active area (a dense editable grid) + optional help rail (300px) that folds below 1100px
 *   footer       — pinned: Back · status · Save and finish later · Save and continue
 *
 * The frame owns no data. It receives the areas (with live counts), the active key, and the scope from the module.
 */
export type ModuleArea = { key: string; label: string; count?: number; tag?: string };
export type ModuleScope = { label: string; onClear?: () => void };

type Ctx = { pending: boolean; setPending: (p: boolean) => void; note?: string; setNote: (n?: string) => void };
const ModuleCtx = createContext<Ctx | null>(null);
export const useModule = () => {
  const c = useContext(ModuleCtx);
  if (!c) throw new Error("useModule must be used inside a ModuleFrame");
  return c;
};

export function ModuleFrame({
  step, total, group, title, subtitle, mode, help, areas, area, onArea, scope, primaryAction, footer, children,
}: {
  step?: number; total?: number; group: string; title: string; subtitle?: string; mode: "guided" | "advanced";
  help?: React.ReactNode; areas: ModuleArea[]; area: string; onArea: (key: string) => void; scope: ModuleScope;
  primaryAction?: React.ReactNode; footer: React.ReactNode; children: React.ReactNode;
}) {
  const [pending, setPending] = useState(false);
  const [note, setNote] = useState<string | undefined>();
  const [helpOpen, setHelpOpen] = useState<boolean>(mode === "guided");
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      try {
        const key = `step-help:${step ?? group}`; const v = localStorage.getItem(key);
        if (v !== null) setHelpOpen(v === "1");                       // remembered choice for this step
        else if (localStorage.getItem("step-help:seen:" + (step ?? group))) setHelpOpen(false); // been here before: data first
        localStorage.setItem("step-help:seen:" + (step ?? group), "1");
      } catch {}
      if (window.innerWidth <= 1100) setHelpOpen(false);   // narrow screens: data first, help on demand
    });
    return () => cancelAnimationFrame(id);
  }, [step, group]);
  const toggleHelp = () => setHelpOpen((h) => { try { localStorage.setItem(`step-help:${step ?? group}`, h ? "0" : "1"); } catch {} return !h; });

  return (
    <ModuleCtx.Provider value={{ pending, setPending, note, setNote }}>
      <div className="grid h-full grid-rows-[auto_auto_minmax(0,1fr)_auto] bg-card">
        {/* module bar */}
        <div className="flex h-10 items-stretch border-b border-input bg-[#E9EDF2] pl-3 pr-2" role="tablist">
          {areas.map((a) => (
            <button key={a.key} type="button" role="tab" aria-selected={area === a.key} onClick={() => onArea(a.key)}
              className={cn("flex items-center whitespace-nowrap border-b-[3px] border-transparent px-3.5 text-[13px] font-semibold text-[#3B4A5A] hover:bg-[#DFE5EC] hover:text-foreground",
                area === a.key && "border-primary bg-card text-primary hover:bg-card")}>
              {a.label}
              {a.count !== undefined && <span className="ml-1.5 inline-block min-w-[18px] rounded-full border border-border bg-secondary px-[5px] text-center text-[10.5px] font-semibold text-muted-foreground">{a.count}</span>}
              {a.tag && <span className="ml-2 rounded-full bg-warn-soft px-2 text-[10px] font-semibold text-warn">{a.tag}</span>}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2 pr-2 text-xs text-muted-foreground">
            Showing
            <span className="inline-flex items-center gap-2 rounded border border-input bg-card py-[3px] pl-2 pr-1 text-[12px] font-semibold text-foreground">
              {scope.label}
              {scope.onClear
                ? <button type="button" onClick={scope.onClear} title="Show everyone" className="px-1 text-[14px] leading-none text-muted-foreground hover:text-bad">×</button>
                : <span className="w-1" />}
            </span>
          </div>
        </div>

        {/* page header */}
        <div className="border-b border-border px-5 pt-2.5">
          <div className="flex min-h-9 items-center gap-3.5">
            <div>
              <span className="eyebrow">{step ? `Step ${step} of ${total} · ${group}` : group}</span>
              <h1 className="text-lg font-semibold leading-tight">{title}{subtitle && <span className="ml-2 text-[13px] font-normal text-muted-foreground">{subtitle}</span>}</h1>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {help && (
                <Button type="button" variant={helpOpen ? "secondary" : "outline"} size="sm" onClick={toggleHelp} aria-pressed={helpOpen} title="Show or hide the coaching notes for this step">
                  <span className="grid size-3.5 place-items-center rounded-full border border-current text-[9px] font-bold">?</span> Help
                </Button>
              )}
              {primaryAction}
            </div>
          </div>
          <div className="-mx-5 mt-2 h-[3px] bg-border">{step && total ? <i className="block h-full bg-primary" style={{ width: `${(step / total) * 100}%` }} /> : null}</div>
        </div>

        {/* body */}
        <div className={cn("grid min-h-0 grid-cols-[minmax(0,1fr)]", help && helpOpen && "grid-cols-[minmax(0,1fr)_300px]")}>
          <div className="min-w-0 overflow-auto">{children}</div>
          {help && helpOpen && <aside className="overflow-auto border-l border-border bg-secondary px-[18px] py-4 [&_h3]:eyebrow [&_h3]:mb-2 [&_p]:mb-2 [&_p]:text-[12.5px]">{help}</aside>}
        </div>

        {footer}
      </div>
    </ModuleCtx.Provider>
  );
}

/** Pinned footer: Back / Save and finish later / Save and continue. `formId` is the module's form. */
export function ModuleFooter({ planId, prevId = "dashboard", formId, nextLabel = "Save and continue →" }: {
  planId: string; prevId?: string; formId: string; nextLabel?: string;
}) {
  const { pending, note } = useModule();
  return (
    <div className="flex items-center justify-between border-t border-border bg-card px-5 py-2.5">
      <Button variant="outline" render={<Link href={`/plans/${planId}/${prevId}`} />}>← Back</Button>
      <span className="text-xs text-muted-foreground">{note ?? "All changes saved"}</span>
      <div className="flex gap-2">
        <Button variant="outline" type="submit" form={formId} name="intent" value="later" disabled={pending}>Save and finish later</Button>
        <Button type="submit" form={formId} name="intent" value="next" disabled={pending}>{pending ? "Saving…" : nextLabel}</Button>
      </div>
    </div>
  );
}

/** Footer for a module that is not a Guided step (e.g. Plan settings): status only, plus a way back. */
export function ModuleStatusFooter({ planId }: { planId: string }) {
  const { note } = useModule();
  return (
    <div className="flex items-center justify-between border-t border-border bg-card px-5 py-2.5">
      <Button variant="outline" render={<Link href={`/plans/${planId}/dashboard`} />}>← Dashboard</Button>
      <span className="text-xs text-muted-foreground">{note ?? "All changes saved"}</span>
      <span />
    </div>
  );
}
