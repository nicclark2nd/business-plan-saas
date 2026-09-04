import { GUIDED_STEPS } from "@/lib/nav";
import { StepFrame, StepFooter } from "./StepFrame";

/**
 * The one frame for all 12 Guided steps: eyebrow, progress bar, title + why, body with a coach aside,
 * and the footer pinned to the bottom of the pane. Steps only supply content, an aside, and the id of
 * the form the footer buttons submit. Nothing important below the fold — Requirements "Closed" 9.
 */
export function GuidedStep({
  planId, step, group, title, why, children, aside, wide, formId, prevId, nextLabel,
}: {
  planId: string; step: number; group: string; title: string; why: string;
  children: React.ReactNode; aside?: React.ReactNode; wide?: boolean;
  formId: string; prevId?: string; nextLabel?: string;
}) {
  const total = GUIDED_STEPS.length;
  return (
    <StepFrame footer={<StepFooter planId={planId} prevId={prevId} formId={formId} nextLabel={nextLabel} />}>
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
    </StepFrame>
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
