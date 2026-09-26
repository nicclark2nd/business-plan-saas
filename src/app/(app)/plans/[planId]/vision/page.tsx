import { createClient } from "@/lib/supabase/server";
import { GuidedStep, CoachPanel, CoachExample } from "@/components/guided/GuidedStep";
import { VisionForm } from "./VisionForm";
import { VISION_FIELDS, visionDraftable, type VisionValues } from "./fields";
import { draftingFor } from "../drafting";

export default async function VisionPage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("plan_framework").select("vision,mission,purpose,brand_promise,ai_direction,field_of_play,exit_intention").eq("plan_id", planId).maybeSingle();
  const initial = Object.fromEntries(VISION_FIELDS.map((f) => [f.key, (data?.[f.key] as string | null) ?? ""])) as VisionValues;

  /*
   * WHAT EACH DRAFT BUTTON MAY CLAIM, AND WHAT IT WILL ASK (§6.106.1, moved §6.109).
   *
   * Six of the seven, because every statement on this step is one only the owner can make and the seventh —
   * whether they want to sell — is one the plan cannot even guess at (§6.129). The loop that works it out
   * moved to `../drafting` when Marketing wanted the same loop — one function, one answer, and the caption is
   * still computed by the same check that decides what is sent.
   */
  const drafting = await draftingFor(planId, VISION_FIELDS.filter(visionDraftable).map((f) => f.key));

  return (
    <GuidedStep
      planId={planId} formId="vision-form" moduleId="vision" step={1} group="Strategy & Direction · Vision & Purpose"
      title="What is this business for?" subtitle="Seven short statements that open your plan"
      help={<>
        <CoachPanel title="Why this matters">
          <p>These statements open your business plan; every lender, grant assessor and investor reads them first. Rough is fine — you can polish later.</p>
          <p>The last one, <b>Selling the business</b>, is the only one AI will not draft for you: nothing in the plan knows what you want to do with it.</p>
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
