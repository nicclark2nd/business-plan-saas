"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Client frame for a Guided step. Owns the compact header (step, title, progress, Help toggle), the optional
 * help column, the pinned footer, and a tiny "pending" context so a step's form can report saving state.
 * Help defaults ON in Guided mode and OFF in Advanced; the user's choice is remembered per device.
 */
type Ctx = { pending: boolean; setPending: (p: boolean) => void; note?: string; setNote: (n?: string) => void };
const StepCtx = createContext<Ctx | null>(null);
export const useStep = () => {
  const c = useContext(StepCtx);
  if (!c) throw new Error("useStep must be used inside a GuidedStep");
  return c;
};

export function StepFrame({
  step, total, group, title, subtitle, mode, help, footer, children,
}: {
  step: number; total: number; group: string; title: string; subtitle?: string; mode: "guided" | "advanced";
  help?: React.ReactNode; footer: React.ReactNode; children: React.ReactNode;
}) {
  const [pending, setPending] = useState(false);
  const [note, setNote] = useState<string | undefined>();
  // Server renders the mode default; the device's remembered choice is applied after mount (avoids hydration mismatch).
  const [helpOpen, setHelpOpen] = useState<boolean>(mode === "guided");
  useEffect(() => {
    const id = requestAnimationFrame(() => { try { const v = localStorage.getItem("step-help"); if (v !== null) setHelpOpen(v === "1"); } catch {} });
    return () => cancelAnimationFrame(id);
  }, []);
  const toggleHelp = () => setHelpOpen((h) => { try { localStorage.setItem("step-help", h ? "0" : "1"); } catch {} return !h; });

  return (
    <StepCtx.Provider value={{ pending, setPending, note, setNote }}>
      <div className="flex min-h-full flex-col">
        {/* compact header: one row */}
        <div className="flex items-end justify-between gap-4">
          <div>
            <span className="eyebrow">Step {step} of {total} · {group}</span>
            <h1 className="mt-0.5 text-xl font-semibold leading-tight">{title}{subtitle && <span className="ml-2 text-sm font-normal text-muted-foreground">{subtitle}</span>}</h1>
          </div>
          {help && (
            <Button type="button" variant={helpOpen ? "secondary" : "outline"} size="sm" onClick={toggleHelp} aria-pressed={helpOpen} title="Show or hide the coaching notes for this step">
              <span className="grid size-4 place-items-center rounded-full border border-current text-[10px] font-bold">?</span> Help
            </Button>
          )}
        </div>
        <div className="mb-4 mt-2 h-1 overflow-hidden rounded bg-border"><i className="block h-full bg-primary" style={{ width: `${(step / total) * 100}%` }} /></div>

        <div className={cn("flex-1 pb-6", help && helpOpen && "grid grid-cols-[minmax(0,1fr)_300px] items-start gap-[18px]")}>
          <div className="min-w-0">{children}</div>
          {help && helpOpen && <aside className="space-y-3">{help}</aside>}
        </div>
        {footer}
      </div>
    </StepCtx.Provider>
  );
}

/** Pinned footer: Back / Save and finish later / Save and continue. `formId` is the step's form. */
export function StepFooter({ planId, prevId = "dashboard", formId, nextLabel = "Save and continue →" }: {
  planId: string; prevId?: string; formId: string; nextLabel?: string;
}) {
  const { pending, note } = useStep();
  return (
    <div className="sticky bottom-0 z-10 -mx-7 flex items-center justify-between border-t border-border bg-background px-7 py-3">
      <Button variant="outline" render={<Link href={`/plans/${planId}/${prevId}`} />}>← Back</Button>
      {note && <span className="text-xs text-muted-foreground">{note}</span>}
      <div className="flex gap-2">
        <Button variant="outline" type="submit" form={formId} name="intent" value="later" disabled={pending}>Save and finish later</Button>
        <Button type="submit" form={formId} name="intent" value="next" disabled={pending}>{pending ? "Saving…" : nextLabel}</Button>
      </div>
    </div>
  );
}
