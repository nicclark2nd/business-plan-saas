"use client";

import Link from "next/link";
import { createContext, useContext, useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * Client frame for a Guided step. Owns the pinned footer and a tiny "pending" context so a step's form
 * can report saving state without the footer living inside the form. Buttons submit the step's form by id.
 */
type Ctx = { pending: boolean; setPending: (p: boolean) => void; note?: string; setNote: (n?: string) => void };
const StepCtx = createContext<Ctx | null>(null);
export const useStep = () => {
  const c = useContext(StepCtx);
  if (!c) throw new Error("useStep must be used inside a GuidedStep");
  return c;
};

export function StepFrame({ children, footer }: { children: React.ReactNode; footer: React.ReactNode }) {
  const [pending, setPending] = useState(false);
  const [note, setNote] = useState<string | undefined>();
  return (
    <StepCtx.Provider value={{ pending, setPending, note, setNote }}>
      <div className="flex min-h-full flex-col">
        <div className="flex-1 pb-6">{children}</div>
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
    <div className="sticky bottom-0 z-10 -mx-7 flex items-center justify-between border-t border-border bg-background px-7 py-3.5">
      <Button variant="outline" render={<Link href={`/plans/${planId}/${prevId}`} />}>← Back</Button>
      {note && <span className="text-xs text-muted-foreground">{note}</span>}
      <div className="flex gap-2">
        <Button variant="outline" type="submit" form={formId} name="intent" value="later" disabled={pending}>Save and finish later</Button>
        <Button type="submit" form={formId} name="intent" value="next" disabled={pending}>{pending ? "Saving…" : nextLabel}</Button>
      </div>
    </div>
  );
}
