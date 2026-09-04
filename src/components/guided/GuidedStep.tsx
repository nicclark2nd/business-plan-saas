import Link from "next/link";
import { GUIDED_STEPS } from "@/lib/nav";
import { Button } from "@/components/ui/button";

/**
 * Shared frame for the 12 Guided steps: step eyebrow, progress bar, title + why, body with a coach aside.
 * The form inside renders <StepFooter> as its last child so the Back / Save buttons stay pinned to the
 * bottom of the pane (nothing important below the fold — Requirements "Closed" 9).
 */
export function GuidedStep({
  step, group, title, why, children, aside, wide,
}: {
  step: number; group: string; title: string; why: string;
  children: React.ReactNode; aside?: React.ReactNode; wide?: boolean;
}) {
  const total = GUIDED_STEPS.length;
  return (
    <div className={wide ? "mx-auto max-w-[960px]" : "mx-auto max-w-[860px]"}>
      <span className="eyebrow">Step {step} of {total} · {group}</span>
      <div className="mb-5 mt-2.5 h-1 overflow-hidden rounded bg-border"><i className="block h-full bg-primary" style={{ width: `${(step / total) * 100}%` }} /></div>
      <h1 className="text-2xl font-semibold leading-tight text-balance">{title}</h1>
      <p className="mt-1.5 max-w-[64ch] text-[13px] text-muted-foreground">{why}</p>
      <div className={aside ? "mt-5 grid grid-cols-[1fr_280px] items-start gap-[18px]" : "mt-5"}>
        <div>{children}</div>
        {aside && <aside className="space-y-3">{aside}</aside>}
      </div>
    </div>
  );
}

export function CoachPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-secondary px-4 py-3.5">
      <h3 className="eyebrow mb-2">{title}</h3>
      <div className="space-y-2 text-[13px]">{children}</div>
    </div>
  );
}

export function CoachExample({ children }: { children: React.ReactNode }) {
  return <div className="mt-2 rounded-r border-l-[3px] border-primary bg-card px-2.5 py-1.5 text-[12.5px] text-muted-foreground">{children}</div>;
}

/** Sticky footer. Render as the last child of the step's <form>. */
export function StepFooter({ planId, prevId = "dashboard", nextLabel = "Save and continue →", pending, note, hasAside = true }: {
  planId: string; prevId?: string; nextLabel?: string; pending?: boolean; note?: React.ReactNode; hasAside?: boolean;
}) {
  // Spans the whole content area (form column + aside) so it reads as the pane's footer, not a floating strip.
  return (
    <div className="sticky bottom-0 z-10 -mx-7 mt-6 flex items-center justify-between border-t border-border bg-background px-7 py-3.5"
      style={hasAside ? { marginRight: "calc(-280px - 18px - 28px)" } : undefined}>
      <Button variant="outline" type="button" render={<Link href={`/plans/${planId}/${prevId}`} />}>← Back</Button>
      {note && <span className="text-xs text-muted-foreground">{note}</span>}
      <div className="flex gap-2">
        <Button variant="outline" type="submit" name="intent" value="later" disabled={pending}>Save and finish later</Button>
        <Button type="submit" name="intent" value="next" disabled={pending}>{pending ? "Saving…" : nextLabel}</Button>
      </div>
    </div>
  );
}
