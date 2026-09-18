import { createClient } from "@/lib/supabase/server";
import { GuidedStep, CoachPanel, CoachExample } from "@/components/guided/GuidedStep";
import { VisionForm } from "./VisionForm";
import { VISION_FIELDS, type VisionValues } from "./fields";
import { gatherReport } from "../reports/gather";
import { planDraft } from "@/engine/ai/draft";
import { DRAFTABLE } from "@/engine/ai/fields";

export default async function VisionPage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("plan_framework").select("vision,mission,purpose,brand_promise,ai_direction,field_of_play").eq("plan_id", planId).maybeSingle();
  const initial = Object.fromEntries(VISION_FIELDS.map((f) => [f.key, (data?.[f.key] as string | null) ?? ""])) as VisionValues;

  /*
   * WHAT EACH DRAFT BUTTON MAY CLAIM, AND WHAT IT WILL ASK (6.106.1).
   *
   * Worked out here, on the server, from the same assembly the report is built from - so the caption under
   * a button is computed by the same check that decides what is sent, and cannot promise data the plan does
   * not hold. It fails soft: AI switched off, or a plan too empty to gather, leaves every button absent
   * rather than breaking the step.
   */
  const { data: aiRow } = await supabase.from("plan_settings").select("ai_enabled").eq("plan_id", planId).maybeSingle();
  let drafting: Record<string, { caption: string; questions: { slice: string; question: string }[] }> = {};
  if (aiRow?.ai_enabled) {
    try {
      const { input } = await gatherReport(planId);
      drafting = Object.fromEntries(VISION_FIELDS.map((f) => {
        const d = planDraft(input, DRAFTABLE[f.key]);
        return [f.key, { caption: d.caption, questions: d.questions }];
      }));
    } catch (e) {
      console.error("vision drafting", e);
    }
  }

  return (
    <GuidedStep
      planId={planId} formId="vision-form" moduleId="vision" step={1} group="Strategy & Direction · Vision & Purpose"
      title="What is this business for?" subtitle="Six short statements that open your plan"
      help={<>
        <CoachPanel title="Why this matters">
          <p>These six statements open your business plan; every lender, grant assessor and investor reads them first. Rough is fine — you can polish later.</p>
        </CoachPanel>
        <CoachPanel title="What good looks like">
          <p>Specific beats grand. A vision a competitor could also claim isn&apos;t a vision.</p>
          <p>A grant assessor is checking that you know exactly what you sell and to whom. Name the customer and the area.</p>
          <CoachExample>&ldquo;To be the best concreter in Australia&rdquo; tells the reader nothing. &ldquo;First-choice for residential slabs in the Illawarra&rdquo; tells them where you&apos;ll win.</CoachExample>
        </CoachPanel>
        <CoachPanel title="Where this goes">
          <p>Opens the <b>Executive Summary</b> in every report template. Read by the AI when it drafts your goals.</p>
        </CoachPanel>
      </>}
    >
      <VisionForm planId={planId} initial={initial} drafting={drafting} />
    </GuidedStep>
  );
}
