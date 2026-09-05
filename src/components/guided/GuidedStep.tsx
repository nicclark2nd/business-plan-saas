import { GUIDED_STEPS } from "@/lib/nav";
import { getSession } from "@/lib/plan";
import { StepFrame, StepFooter } from "./StepFrame";

/**
 * The one frame for all 12 Guided steps. Steps supply: title, a one-line subtitle, the working content,
 * optional help (coach panels, shown in a toggleable right column), and the id of the form the footer submits.
 */
export async function GuidedStep({
  planId, step, group, title, subtitle, children, help, formId, prevId, nextLabel,
}: {
  planId: string; step: number; group: string; title: string; subtitle?: string;
  children: React.ReactNode; help?: React.ReactNode; formId: string; prevId?: string; nextLabel?: string;
}) {
  const session = await getSession();
  const mode = (session?.profile?.mode ?? "guided") as "guided" | "advanced";
  return (
    <StepFrame step={step} total={GUIDED_STEPS.length} group={group} title={title} subtitle={subtitle} mode={mode} help={help}
      footer={<StepFooter planId={planId} prevId={prevId} formId={formId} nextLabel={nextLabel} />}>
      {children}
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
